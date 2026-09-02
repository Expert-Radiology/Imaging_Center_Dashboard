/**
 * The dashboard payload contract.
 *
 * One shape, produced by the refresh Function from ClickUp and consumed by the
 * browser. The seed snapshot in `src/data/seed.ts` satisfies the same contract,
 * so the UI never knows whether it is reading live data or the bundled fallback.
 */

/** Milestone / line-item rendering states. `na` means "not in scope", not "unknown". */
export type Glyph = 'done' | 'progress' | 'notdone' | 'na';

export type StatusKey = 'excellent' | 'satisfactory' | 'watch' | 'serious' | 'critical';

/** The five `Pending Contact?` dropdown options, mapped 1:1. */
export type BlockerGroupKey = 'customer' | 'ramsoft' | 'internal' | 'clientPacs' | 'technosoft';

export type FinalFlag = 'done' | 'notdone' | 'onhold';

/**
 * A field the dashboard displays that has no ClickUp source yet. Rendered as a
 * gap, never defaulted. See the Critical Data-Model Prerequisite in the handoff.
 */
export type UnsourcedField =
  | 'hl7VpnStatus'
  | 'hl7TestingStatus'
  | 'facilityStationSplit'
  | 'estimatedDeploymentDate';

export interface Milestones {
  vpnForm: Glyph;
  ping: Glyph;
  testStudy: Glyph;
  headerTemplate: Glyph;
  ramsoftStation: Glyph;
}

export interface MatrixLineItems {
  dicomVpn: Glyph;
  hl7Vpn: Glyph;
  dicomStudy: Glyph;
  hl7Test: Glyph;
  facility: Glyph;
  station: Glyph;
  headerDotx: Glyph;
}

export interface EstimatedDeployment {
  /** Display label, e.g. "Sep 1–7" or "Unscheduled". */
  label: string;
  /** True while no committed date exists — renders with the `*` marker. */
  proposed: boolean;
}

/**
 * One row per *connection*, not per center. A center with both a DICOM and an
 * HL7 path that go live on different dates becomes two Connections sharing a
 * `centerId`.
 */
export interface Connection {
  /** Stable row id. `${taskId}` today, `${taskId}:${path}` once paths split. */
  id: string;
  /** ClickUp task id — the deep-link target. */
  centerId: string;
  centerName: string;
  /** Suffixed qualifier shown after the name on the summary view, e.g. "OH · 3 loc". */
  qualifier: string | null;
  connectionType: string | null;
  pacsVendor: string | null;
  owner: string | null;
  state: string | null;
  locationCount: number | null;
  /** Parsed from the AI text field `Date Start`; null when unparseable. */
  startDate: string | null;
  daysInPipeline: number | null;
  percentComplete: number | null;
  status: StatusKey;
  onHold: boolean;
  newThisWeek: boolean;
  urgent: boolean;
  blockerGroup: BlockerGroupKey | null;
  /** Full blocker sentence for the matrix + blockers panel. */
  blockerText: string | null;
  /** Short "Waiting On" cell for the summary milestone matrix. */
  waitingOn: string | null;
  nextAction: string | null;
  estimatedDeployment: EstimatedDeployment | null;
  ramsoftTicketId: string | null;
  milestones: Milestones;
  lineItems: MatrixLineItems;
  finalFlag: FinalFlag;
  /** ClickUp `date_updated`, ISO. Drives the staleness flag. */
  lastActivityAt: string | null;
  /** Fields on this row with no ClickUp source behind them. */
  unsourced: UnsourcedField[];
}

export interface ThroughputWeek {
  /** e.g. "Sep 1 – 7" */
  label: string;
  /** "Current week", "Week +1", … */
  sublabel: string;
  isCurrent: boolean;
  /** Target go-lives. Null is not possible here — an empty week is a measured 0. */
  expected: number;
  /**
   * Confirmed live. `null` means "not yet measurable" (a future week) and renders
   * as a dim em dash — deliberately distinct from a measured 0.
   */
  actual: number | null;
  centersInScope: string[];
}

export interface BlockerItem {
  /** Bolded lead clause — a center name, or a grouped subject like "7 on-hold centers". */
  label: string;
  /** The rest of the sentence. */
  text: string;
  /** Connection this came from, when it maps to one. Null for editorial entries. */
  connectionId: string | null;
}

export interface BlockerColumn {
  group: BlockerGroupKey;
  items: BlockerItem[];
}

export interface DecisionCard {
  id: string;
  title: string;
  status: StatusKey;
  meta: string[];
  /** Editorial copy. Null for rule-flagged candidates nobody has written up yet. */
  nextStep: string | null;
  /** True when a human pinned this, false when a rule surfaced it. */
  pinned: boolean;
}

export interface TeamCard {
  projectLead: string;
  onboardingIntegrations: string;
  clientSuccess: string;
  /** Distinct assignees on open tasks. */
  centerOwners: string[];
}

export interface FieldCoverage {
  /** In-flight centers with `Pending Contact?` empty. */
  pendingContactMissing: number;
  inFlightCount: number;
  /** The four columns with no ClickUp field behind them, still missing. */
  missingFields: UnsourcedField[];
  /** Worst ClickUp staleness case: subtasks contradicted by newer activity. */
  stalestCenter: { name: string; note: string } | null;
}

export interface WeekWindow {
  /** ISO date, Monday, America/Puerto_Rico. */
  start: string;
  /** ISO date, Sunday. */
  end: string;
  /** e.g. "Week of Sep 1 – Sep 7, 2026" */
  label: string;
}

export interface DashboardPayload {
  /** ISO timestamp of the successful ClickUp read that produced this payload. */
  generatedAt: string;
  source: 'clickup' | 'seed';
  week: WeekWindow;
  totals: {
    totalCenters: number;
    open: number;
    inFlight: number;
    onHold: number;
    newThisWeek: number;
    liveThisWeek: number;
  };
  overallStatus: StatusKey;
  /** From last Monday's persisted snapshot. Null until one exists. */
  lastWeekStatus: StatusKey | null;
  team: TeamCard;
  connections: Connection[];
  /** The five `Pending Contact?` groups, in dropdown order. Always all five. */
  blockers: BlockerColumn[];
  throughput: ThroughputWeek[];
  decisions: DecisionCard[];
  fieldCoverage: FieldCoverage;
  /** Non-fatal problems worth showing, e.g. "Progress field unavailable". */
  warnings: string[];
}

/** A Monday snapshot, persisted so week-over-week comparisons are possible. */
export interface WeeklySnapshot {
  weekStart: string;
  capturedAt: string;
  overallStatus: StatusKey;
  openConnectionIds: string[];
  perConnection: Array<{
    id: string;
    centerName: string;
    status: StatusKey;
    percentComplete: number | null;
    milestones: Milestones;
    finalFlag: FinalFlag;
  }>;
}
