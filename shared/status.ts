import type { BlockerGroupKey, Connection, Milestones, StatusKey } from './types';

/**
 * The five-point scale.
 *
 * Thresholds were inferred from the design reference, not specified — open
 * question #5 for Cristian. They live here, in one place, so confirming them is
 * a single edit rather than a hunt.
 */
export const STATUS_THRESHOLDS = {
  criticalDays: 180,
  seriousDays: 90,
  stalledDays: 30,
  watchDays: 15,
} as const;

export const SEVERITY_RANK: Record<StatusKey, number> = {
  critical: 5,
  serious: 4,
  watch: 3,
  satisfactory: 2,
  excellent: 1,
};

export interface StatusInput {
  daysInPipeline: number | null;
  percentComplete: number | null;
  blockerGroup: BlockerGroupKey | null;
  owner: string | null;
  startDate: string | null;
  milestones: Milestones;
}

function allMilestonesClosed(m: Milestones): boolean {
  return Object.values(m).every((g) => g === 'done' || g === 'na');
}

export function deriveStatus(input: StatusInput): StatusKey {
  const { daysInPipeline: days, percentComplete: pct, blockerGroup, owner, startDate } = input;

  if (days !== null && days >= STATUS_THRESHOLDS.criticalDays) return 'critical';

  if (days !== null && days >= STATUS_THRESHOLDS.seriousDays) return 'serious';
  if (blockerGroup === 'customer' && days !== null && days >= STATUS_THRESHOLDS.stalledDays) {
    return 'serious';
  }
  if (days !== null && days >= STATUS_THRESHOLDS.stalledDays && (pct ?? 0) === 0) {
    return 'serious';
  }

  // Checked only after the aging bands, not before them. A connection whose
  // milestones are all closed but which has been open 261 days waiting on a
  // duplicate RamSoft tunnel is Critical, not Excellent — the live data made
  // this concrete: PDI was reporting Excellent at 261 days.
  if (allMilestonesClosed(input.milestones)) return 'excellent';

  if (days !== null && days >= STATUS_THRESHOLDS.watchDays) return 'watch';
  // No owner and no start date are themselves risks — an unmeasurable
  // connection is not a healthy one.
  if (!owner || !startDate) return 'watch';
  if (blockerGroup !== null) return 'watch';

  return 'satisfactory';
}

/** Worst status across the in-flight set — the "Overall pipeline status" pill. */
export function overallStatus(connections: Connection[]): StatusKey {
  const inFlight = connections.filter((c) => !c.onHold);
  if (inFlight.length === 0) return 'satisfactory';
  return inFlight.reduce<StatusKey>(
    (worst, c) => (SEVERITY_RANK[c.status] > SEVERITY_RANK[worst] ? c.status : worst),
    'excellent',
  );
}

/**
 * Intended reading order: severity first, then aging within a severity band.
 * Unknown aging sorts after known aging — a row with no start date is a gap to
 * be filled, not a row to be led with.
 */
export function readingOrder(a: Connection, b: Connection): number {
  if (a.onHold !== b.onHold) return a.onHold ? 1 : -1;

  const severity = SEVERITY_RANK[b.status] - SEVERITY_RANK[a.status];
  if (severity !== 0) return severity;

  const aDays = a.daysInPipeline;
  const bDays = b.daysInPipeline;
  if (aDays === null && bDays === null) return a.centerName.localeCompare(b.centerName);
  if (aDays === null) return 1;
  if (bDays === null) return -1;
  return bDays - aDays;
}
