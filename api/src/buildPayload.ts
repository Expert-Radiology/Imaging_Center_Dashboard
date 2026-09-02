import type {
  BlockerColumn,
  BlockerGroupKey,
  BlockerItem,
  Connection,
  DashboardPayload,
  DecisionCard,
  StatusKey,
  ThroughputWeek,
  WeeklySnapshot,
} from '../../shared/types';
import { overallStatus, readingOrder, SEVERITY_RANK } from '../../shared/status';
import { ClickUpClient, mapWithConcurrency } from './clickup/client';
import { normalizeConnection, resolvePendingFields } from './clickup/normalize';
import { isClosed } from './clickup/parse';
import editorial from './content/editorial.json';
import { hqToday, weekStartFor, weekLabelFor, weekRangeLabel, addWeeks } from './time';

const GROUP_ORDER: BlockerGroupKey[] = [
  'customer',
  'ramsoft',
  'internal',
  'clientPacs',
  'technosoft',
];

export interface BuildOptions {
  listId: string;
  now?: Date;
  /** Last Monday's snapshot, when one exists. */
  previousSnapshot?: WeeklySnapshot | null;
  /** Snapshots covering the six-week window, for the "actually completed" row. */
  history?: WeeklySnapshot[];
}

export async function buildPayload(
  client: ClickUpClient,
  options: BuildOptions,
): Promise<DashboardPayload> {
  const now = options.now ?? new Date();
  const today = hqToday(now);
  const weekStart = weekStartFor(today);
  const warnings: string[] = [];
  const warn = (message: string) => {
    if (!warnings.includes(message)) warnings.push(message);
  };

  const [allTasks, listFields, totalCenters] = await Promise.all([
    client.listOpenCenters(options.listId),
    client.listCustomFields(options.listId),
    client.countAllCenters(options.listId).catch(() => 0),
  ]);

  const pendingFields = resolvePendingFields(listFields);

  // `include_closed=false` filters on the status *type*, and this list's
  // "completed" status is not typed closed — so the endpoint returns every
  // finished center too. Verified against the live list: 107 tasks come back,
  // of which 79 are completed and 28 genuinely open. Filtering here rather than
  // trusting the query parameter is what makes the counts match reality.
  const openTasks = allTasks.filter((task) => !isClosed(task));

  // One detail call per open center for subtask completion. Bounded so a large
  // pipeline degrades gracefully instead of hammering the rate limit.
  const detailed = await mapWithConcurrency(openTasks, 5, async (task) => {
    try {
      return await client.getTaskWithSubtasks(task.id);
    } catch (error) {
      warn(`${task.name}: subtask fetch failed (${(error as Error).message}); milestones unavailable`);
      return task;
    }
  });

  const connections = detailed
    .map((task) => normalizeConnection(task, { pendingFields, weekStart, today, warn }))
    .map(applyEditorial)
    .sort(readingOrder);

  const inFlight = connections.filter((c) => !c.onHold);
  const held = connections.filter((c) => c.onHold);

  const throughput = buildThroughput(connections, weekStart, options.history ?? [], pendingFields);
  const blockers = buildBlockers(inFlight);
  const pendingContactMissing = inFlight.filter((c) => c.blockerGroup === null).length;

  return {
    generatedAt: now.toISOString(),
    source: 'clickup',
    week: {
      start: weekStart,
      end: addWeeks(weekStart, 0, 6),
      label: weekLabelFor(weekStart),
    },
    totals: {
      totalCenters: totalCenters || connections.length,
      open: connections.length,
      inFlight: inFlight.length,
      onHold: held.length,
      newThisWeek: connections.filter((c) => c.newThisWeek).length,
      liveThisWeek: countLiveThisWeek(options.history ?? [], weekStart),
    },
    overallStatus: overallStatus(connections),
    lastWeekStatus: options.previousSnapshot?.overallStatus ?? null,
    team: {
      ...editorial.team,
      centerOwners: distinctOwners(connections),
    },
    connections,
    blockers,
    throughput,
    decisions: buildDecisions(connections),
    fieldCoverage: {
      pendingContactMissing,
      inFlightCount: inFlight.length,
      missingFields: missingFieldList(pendingFields),
      stalestCenter: findStalest(inFlight, now),
    },
    warnings,
  };
}

/**
 * Editorial content is keyed by the center's readable name, but ClickUp task
 * names carry decoration the humans writing that file do not: connection-type
 * suffixes ("Paragon Imaging - SaaS"), qualifiers in parentheses ("Precision
 * Diagnostic Imaging (PDI)"), inconsistent ampersands, and trailing spaces.
 * Matching on the raw name left 10 of 28 connections with no next action.
 *
 * Both sides are reduced to the same key. Genuine mismatches that no rule can
 * fix — "Gloabal DX" is misspelled in ClickUp itself — go in `aliases`.
 */
function nameKey(name: string): string {
  const aliases = (editorial.aliases ?? {}) as Record<string, string>;
  const resolved = aliases[name.trim()] ?? name;

  return resolved
    .toLowerCase()
    .replace(/\s+-\s+.*$/, ' ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/\b(saas only|saas|new deal)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Build a lookup whose keys are normalized the same way. */
function keyed<T>(source: Record<string, T>): Map<string, T> {
  return new Map(Object.entries(source).map(([name, value]) => [nameKey(name), value]));
}

const NEXT_ACTIONS = keyed(editorial.nextActions as Record<string, string>);
const SHORT_NAMES = keyed(editorial.shortNames as Record<string, string>);

/** Next actions are editorial. A center with none renders an em dash, not a guess. */
function applyEditorial(connection: Connection): Connection {
  return { ...connection, nextAction: NEXT_ACTIONS.get(nameKey(connection.centerName)) ?? null };
}

function distinctOwners(connections: Connection[]): string[] {
  const owners = new Set<string>();
  for (const c of connections) if (c.owner) owners.add(c.owner);
  return [...owners].sort();
}

function buildBlockers(inFlight: Connection[]): BlockerColumn[] {
  const columns = new Map<BlockerGroupKey, BlockerItem[]>(
    GROUP_ORDER.map((group) => [group, []]),
  );

  for (const connection of inFlight) {
    if (!connection.blockerGroup) continue;
    columns.get(connection.blockerGroup)?.push({
      label: shortName(connection.centerName),
      text: stripGroupPrefix(connection.blockerText ?? ''),
      connectionId: connection.id,
    });
  }

  // Real blockers with no ClickUp task behind them — infrastructure work, a
  // ticket on an already-completed center.
  for (const extra of editorial.blockerExtras as Array<{
    group: string;
    label: string;
    text: string;
  }>) {
    columns.get(extra.group as BlockerGroupKey)?.push({
      label: extra.label,
      text: extra.text,
      connectionId: null,
    });
  }

  return GROUP_ORDER.map((group) => ({ group, items: columns.get(group) ?? [] }));
}

function stripGroupPrefix(text: string): string {
  const separator = text.indexOf('—');
  return separator >= 0 ? text.slice(separator + 1).trim() : text;
}

function shortName(name: string): string {
  return SHORT_NAMES.get(nameKey(name)) ?? name.trim();
}

function buildThroughput(
  connections: Connection[],
  weekStart: string,
  history: WeeklySnapshot[],
  pendingFields: ReturnType<typeof resolvePendingFields>,
): ThroughputWeek[] {
  const hasRealDates = pendingFields.estimatedDeployment !== null;
  const proposed = editorial.proposedSequence as Record<string, string[]>;
  const todayWeek = weekStart;

  return Array.from({ length: 6 }, (_, offset) => {
    const start = addWeeks(weekStart, offset);
    const label = weekRangeLabel(start);

    const scheduled = hasRealDates
      ? connections
          .filter((c) => c.estimatedDeployment && !c.onHold)
          .filter((c) => weekStartFor(c.estimatedDeployment!.label) === start)
          .map((c) => shortName(c.centerName))
      : (proposed[String(offset)] ?? [])
          .filter((name) => connections.some((c) => nameKey(c.centerName) === nameKey(name)))
          .map(shortName);

    // A future week is not measurable yet — null, distinct from a measured 0.
    const isPastOrCurrent = start <= todayWeek;
    const actual = isPastOrCurrent ? countLiveThisWeek(history, start) : null;

    return {
      label,
      sublabel: offset === 0 ? 'Current week' : `Week +${offset}`,
      isCurrent: offset === 0,
      expected: scheduled.length,
      actual,
      centersInScope: scheduled,
    };
  });
}

/**
 * A go-live is counted when a connection that was open in one snapshot is
 * closed in the next — the only way to measure it without a go-live date field.
 */
function countLiveThisWeek(history: WeeklySnapshot[], weekStart: string): number {
  const ordered = [...history].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const index = ordered.findIndex((s) => s.weekStart === weekStart);
  if (index <= 0) return 0;

  const previous = new Set(ordered[index - 1].openConnectionIds);
  const current = new Set(ordered[index].openConnectionIds);
  let count = 0;
  for (const id of previous) if (!current.has(id)) count++;
  return count;
}

/**
 * Editorial cards first, then rule-flagged candidates with no copy written.
 * The rules are the ones the handoff names: critical status, aging past the
 * threshold, unassigned, and contradictory flags like urgent-while-held.
 */
function buildDecisions(connections: Connection[]): DecisionCard[] {
  const pinned: DecisionCard[] = (editorial.decisions as Array<{
    id: string;
    title: string;
    status: string;
    meta: string[];
    nextStep: string;
  }>).map((card) => ({
    id: card.id,
    title: card.title,
    status: card.status as StatusKey,
    meta: card.meta,
    nextStep: card.nextStep,
    pinned: true,
  }));

  const covered = new Set(pinned.map((card) => nameKey(card.title)));
  const candidates: DecisionCard[] = [];

  for (const connection of connections) {
    if (covered.has(nameKey(connection.centerName))) continue;

    const reasons: string[] = [];
    if (connection.status === 'critical') reasons.push('Critical status');
    if ((connection.daysInPipeline ?? 0) >= 90) {
      reasons.push(`${connection.daysInPipeline} days in pipeline`);
    }
    if (!connection.owner) reasons.push('No owner assigned');
    if (connection.urgent && connection.onHold) reasons.push('Urgent tag on a held connection');
    if (reasons.length === 0) continue;

    candidates.push({
      id: `rule-${connection.id}`,
      title: connection.centerName,
      status: connection.status,
      meta: [reasons.join(' · '), 'Flagged by rule — not yet reviewed'],
      nextStep: null,
      pinned: false,
    });
  }

  candidates.sort((a, b) => SEVERITY_RANK[b.status] - SEVERITY_RANK[a.status]);
  // Six cards fill the three-column grid twice over; more than nine is a wall,
  // not an agenda.
  return [...pinned, ...candidates].slice(0, 9);
}

function missingFieldList(pendingFields: ReturnType<typeof resolvePendingFields>) {
  const missing: DashboardPayload['fieldCoverage']['missingFields'] = [];
  if (!pendingFields.hl7VpnStatus) missing.push('hl7VpnStatus');
  if (!pendingFields.hl7TestingStatus) missing.push('hl7TestingStatus');
  if (!pendingFields.facilityBuilt || !pendingFields.stationBuilt) {
    missing.push('facilityStationSplit');
  }
  if (!pendingFields.estimatedDeployment) missing.push('estimatedDeploymentDate');
  return missing;
}

const STALENESS_DAYS = 21;

/**
 * ClickUp staleness, not fetch staleness: a center reporting low progress whose
 * task has not been touched in weeks is very likely further along than it says.
 */
function findStalest(
  inFlight: Connection[],
  now: Date,
): DashboardPayload['fieldCoverage']['stalestCenter'] {
  let worst: { connection: Connection; days: number } | null = null;

  for (const connection of inFlight) {
    if (!connection.lastActivityAt) continue;
    const days = Math.floor(
      (now.getTime() - new Date(connection.lastActivityAt).getTime()) / 86_400_000,
    );
    if (days < STALENESS_DAYS) continue;
    if ((connection.percentComplete ?? 0) >= 90) continue;
    if (!worst || days > worst.days) worst = { connection, days };
  }

  if (!worst) return null;
  return {
    name: shortName(worst.connection.centerName),
    note: `its ClickUp task has not been touched in ${worst.days} days while its subtasks still read ${worst.connection.percentComplete ?? 0}% complete`,
  };
}
