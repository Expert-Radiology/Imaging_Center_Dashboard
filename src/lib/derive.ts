import type { Connection, DashboardPayload, StatusKey } from '../../shared/types';
import { readingOrder } from '../../shared/status';
import { color } from '../styles/tokens';
import { relativeTime } from './week';

/** Whitespace-insensitive compare so "Sep 29 – Oct 5" matches "Sep 29–Oct 5". */
function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, '').toLowerCase();
}

const UNSCHEDULED_RANK = 900;
const ON_HOLD_RANK = 1000;

/**
 * Connection matrix order: the deployment sequence, so the meeting reads it
 * top-to-bottom as a plan. Unscheduled work sits below the scheduled weeks and
 * held connections below that, in their own block.
 */
export function deploymentOrder(payload: DashboardPayload): Connection[] {
  const weekRank = new Map<string, number>();
  payload.throughput.forEach((w, i) => weekRank.set(normalizeLabel(w.label), i));

  const rank = (c: Connection): number => {
    if (c.onHold) return ON_HOLD_RANK;
    const label = c.estimatedDeployment?.label;
    if (!label) return UNSCHEDULED_RANK;
    return weekRank.get(normalizeLabel(label)) ?? UNSCHEDULED_RANK;
  };

  // Stable: within a deployment week, payload order (severity, then aging) holds.
  return [...payload.connections]
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map(({ c }) => c);
}

/**
 * In-flight connections with no week in the six-week window — the ones the
 * throughput callout names as held back.
 *
 * Derived from each connection's own deployment week rather than by matching
 * center names against the "centers in scope" labels: those labels are short
 * names ("PDI", "One Step Dx"), and name matching silently reported scheduled
 * centers as unscheduled.
 */
export function unscheduledConnections(payload: DashboardPayload): Connection[] {
  const weeks = new Set(payload.throughput.map((w) => normalizeLabel(w.label)));
  return payload.connections.filter((c) => {
    if (c.onHold) return false;
    const label = c.estimatedDeployment?.label;
    return !label || !weeks.has(normalizeLabel(label));
  });
}

/** Summary milestone matrix: in-flight only, in the payload's reading order. */
export function inFlightOrder(payload: DashboardPayload): Connection[] {
  return payload.connections.filter((c) => !c.onHold).sort(readingOrder);
}

export function heldConnections(payload: DashboardPayload): Connection[] {
  return payload.connections.filter((c) => c.onHold);
}

/** Aging colour ramp — the same bands the status scale uses. */
export function daysColor(days: number | null): string {
  if (days === null) return color.textPlaceholder;
  if (days >= 180) return color.criticalNumber;
  if (days >= 30) return color.serious;
  if (days >= 15) return color.watch;
  return color.textBody;
}

export function percentColor(pct: number | null): string {
  if (pct === null) return color.textPlaceholder;
  if (pct >= 70) return color.excellent;
  return color.textSecondary;
}

export type FreshnessLevel = 'live' | 'aging' | 'stale' | 'failed' | 'snapshot';

export interface Freshness {
  level: FreshnessLevel;
  dotColor: string;
  caption: string;
}

/**
 * Thresholds track the refresh cadence: the job runs hourly, so data an hour
 * old is normal, one missed run is worth noticing, and three is a fault.
 */
const FRESHNESS_AGING_MS = 75 * 60 * 1000;
const FRESHNESS_STALE_MS = 180 * 60 * 1000;

/**
 * The credibility line. Two rules it must never break: never present a failed
 * refresh as fresh, and never blank the board — the last good payload stays up,
 * visibly timestamped.
 */
export function freshness(
  payload: DashboardPayload | null,
  lastError: string | null,
  now: Date = new Date(),
): Freshness {
  if (!payload) {
    return {
      level: 'failed',
      dotColor: color.critical,
      caption: lastError ? `No data · ${lastError}` : 'Loading…',
    };
  }

  if (payload.source === 'seed') {
    return {
      level: 'snapshot',
      dotColor: color.watch,
      caption: lastError
        ? `Bundled snapshot · live refresh unavailable · ${lastError}`
        : 'Bundled snapshot · live ClickUp refresh not yet wired',
    };
  }

  // Age is measured from when ClickUp was read, never from when the browser
  // last fetched. Polling a three-hour-old payload every ten minutes would
  // otherwise report "updated just now" — stale data presented as fresh, which
  // is the one thing this strip exists to prevent.
  const readAt = new Date(payload.generatedAt);
  const age = now.getTime() - readAt.getTime();
  const ago = relativeTime(payload.generatedAt, now);

  if (lastError) {
    return {
      level: age > FRESHNESS_STALE_MS ? 'stale' : 'aging',
      dotColor: age > FRESHNESS_STALE_MS ? color.critical : color.watch,
      caption: `Last good data ${ago} · refresh failed: ${lastError}`,
    };
  }

  if (age > FRESHNESS_STALE_MS) {
    return { level: 'stale', dotColor: color.critical, caption: `Updated ${ago} · refresh overdue` };
  }
  if (age > FRESHNESS_AGING_MS) {
    return { level: 'aging', dotColor: color.watch, caption: `Updated ${ago}` };
  }
  return { level: 'live', dotColor: color.excellent, caption: `Updated ${ago}` };
}

/** ClickUp task deep link. Empty on seed rows, which carry no task id. */
export function clickUpUrl(connection: Connection): string | null {
  return connection.centerId ? `https://app.clickup.com/t/${connection.centerId}` : null;
}

export function ramsoftUrl(ticketId: string | null): string | null {
  return ticketId ? `https://support.ramsoft.com/a/tickets/${ticketId}` : null;
}

export const STATUS_ORDER: StatusKey[] = [
  'excellent',
  'satisfactory',
  'watch',
  'serious',
  'critical',
];
