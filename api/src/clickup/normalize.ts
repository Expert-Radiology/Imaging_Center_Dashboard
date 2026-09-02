import type {
  BlockerGroupKey,
  Connection,
  Glyph,
  MatrixLineItems,
  Milestones,
  UnsourcedField,
} from '../../../shared/types';
import { deriveStatus } from '../../../shared/status';
import type { ClickUpCustomField, ClickUpTask } from './client';
import {
  DICOM_STUDY_MATCHERS,
  DICOM_VPN_MATCHERS,
  FACILITY_MATCHERS,
  FIELD,
  HEADER_DOTX_MATCHERS,
  HL7_TEST_MATCHERS,
  MILESTONE_MATCHERS,
  PENDING_CONTACT_TO_GROUP,
  PENDING_FIELD_NAMES,
  STATION_MATCHERS,
} from './fields';
import {
  dropdownValue,
  epochToIso,
  fieldByName,
  hasTag,
  isClosed,
  numberValue,
  parseDateStart,
  progressValue,
  textValue,
} from './parse';

/** Which of the four missing fields actually exist on the list right now. */
export interface PendingFieldMap {
  hl7VpnStatus: ClickUpCustomField | null;
  hl7TestingStatus: ClickUpCustomField | null;
  facilityBuilt: ClickUpCustomField | null;
  stationBuilt: ClickUpCustomField | null;
  estimatedDeployment: ClickUpCustomField | null;
}

export function resolvePendingFields(fields: ClickUpCustomField[]): PendingFieldMap {
  return {
    hl7VpnStatus: fieldByName(fields, PENDING_FIELD_NAMES.hl7VpnStatus),
    hl7TestingStatus: fieldByName(fields, PENDING_FIELD_NAMES.hl7TestingStatus),
    facilityBuilt: fieldByName(fields, PENDING_FIELD_NAMES.facilityBuilt),
    stationBuilt: fieldByName(fields, PENDING_FIELD_NAMES.stationBuilt),
    estimatedDeployment: fieldByName(fields, PENDING_FIELD_NAMES.estimatedDeployment),
  };
}

const HOLD_STATUSES = new Set(['on hold', 'hold', 'paused']);

function subtaskGlyph(subtasks: ClickUpTask[], matchers: readonly RegExp[]): Glyph | null {
  const matched = subtasks.filter((s) => matchers.some((m) => m.test(s.name)));
  if (matched.length === 0) return null;

  if (matched.every(isClosed)) return 'done';
  const status = (s: ClickUpTask) => s.status?.status?.toLowerCase() ?? '';
  if (matched.some((s) => isClosed(s) || status(s) === 'in progress')) return 'progress';
  return 'notdone';
}

function milestones(subtasks: ClickUpTask[]): { value: Milestones; matchedAny: boolean } {
  const read = (matchers: readonly RegExp[]): Glyph => subtaskGlyph(subtasks, matchers) ?? 'notdone';
  const matchedAny = Object.values(MILESTONE_MATCHERS).some(
    (matchers) => subtaskGlyph(subtasks, matchers) !== null,
  );

  return {
    matchedAny,
    value: {
      vpnForm: read(MILESTONE_MATCHERS.vpnForm),
      ping: read(MILESTONE_MATCHERS.ping),
      testStudy: read(MILESTONE_MATCHERS.testStudy),
      headerTemplate: read(MILESTONE_MATCHERS.headerTemplate),
      ramsoftStation: read(MILESTONE_MATCHERS.ramsoftStation),
    },
  };
}

/** Dropdown labels from the (future) HL7 fields, mapped onto glyphs. */
function hl7Glyph(label: string | null): Glyph | null {
  if (!label) return null;
  const value = label.trim().toLowerCase();
  if (value === 'n/a' || value === 'na' || value === 'not applicable') return 'na';
  if (value === 'validated' || value === 'passed' || value === 'tunnel up') return 'done';
  if (value === 'requested' || value === 'in progress') return 'progress';
  return 'notdone';
}

function checkboxGlyph(value: unknown): Glyph | null {
  if (value === true) return 'done';
  if (value === false) return 'notdone';
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'done', 'built'].includes(normalized)) return 'done';
    if (['false', 'no', 'not started'].includes(normalized)) return 'notdone';
    if (normalized === 'in progress') return 'progress';
    if (normalized === 'n/a') return 'na';
  }
  return null;
}

function blockerGroupOf(label: string | null): BlockerGroupKey | null {
  if (!label) return null;
  const key = PENDING_CONTACT_TO_GROUP[label.trim().toLowerCase()];
  return (key as BlockerGroupKey | undefined) ?? null;
}

export interface NormalizeContext {
  pendingFields: PendingFieldMap;
  /** Start of the current HQ week, ISO date — drives newThisWeek. */
  weekStart: string;
  /** Today in HQ time, ISO date — drives aging. */
  today: string;
  warn: (message: string) => void;
}

export function normalizeConnection(task: ClickUpTask, context: NormalizeContext): Connection {
  const subtasks = task.subtasks ?? [];
  const { value: ms, matchedAny } = milestones(subtasks);

  if (subtasks.length > 0 && !matchedAny) {
    context.warn(
      `${task.name}: no subtask matched a milestone pattern — its milestone columns will read as "not done"`,
    );
  }

  const statusLabel = task.status?.status?.toLowerCase() ?? '';
  const onHold = HOLD_STATUSES.has(statusLabel);

  const startDate = parseDateStart(textValue(task, FIELD.dateStart));
  const daysInPipeline = daysBetween(startDate, context.today);
  const percentComplete = progressValue(task, FIELD.progress);
  const pendingContact = dropdownValue(task, FIELD.pendingContact);
  const blockerGroup = blockerGroupOf(pendingContact);

  const hl7Flag = textValue(task, FIELD.hl7);
  const connectionType = resolveType(textValue(task, FIELD.typeOfConnection), hl7Flag);
  const usesHl7 = connectionType === 'HL7' || /yes|true/i.test(hl7Flag ?? '');
  const usesDicom = connectionType !== 'HL7';

  const unsourced: UnsourcedField[] = [];
  const { pendingFields } = context;

  const hl7VpnRaw = pendingFields.hl7VpnStatus
    ? dropdownValue(task, pendingFields.hl7VpnStatus.id)
    : null;
  if (!pendingFields.hl7VpnStatus) unsourced.push('hl7VpnStatus');

  const hl7TestRaw = pendingFields.hl7TestingStatus
    ? dropdownValue(task, pendingFields.hl7TestingStatus.id)
    : null;
  if (!pendingFields.hl7TestingStatus) unsourced.push('hl7TestingStatus');

  if (!pendingFields.facilityBuilt || !pendingFields.stationBuilt) {
    unsourced.push('facilityStationSplit');
  }
  if (!pendingFields.estimatedDeployment) unsourced.push('estimatedDeploymentDate');

  const facilityGlyph =
    (pendingFields.facilityBuilt
      ? checkboxGlyph(rawValue(task, pendingFields.facilityBuilt.id))
      : null) ??
    subtaskGlyph(subtasks, FACILITY_MATCHERS) ??
    'notdone';

  const stationGlyph =
    (pendingFields.stationBuilt
      ? checkboxGlyph(rawValue(task, pendingFields.stationBuilt.id))
      : null) ??
    subtaskGlyph(subtasks, STATION_MATCHERS) ??
    'notdone';

  const pingPassed = /^yes$/i.test(textValue(task, FIELD.pingPassed) ?? '');

  const lineItems: MatrixLineItems = {
    dicomVpn: usesDicom
      ? pingPassed
        ? 'done'
        : (subtaskGlyph(subtasks, DICOM_VPN_MATCHERS) ?? 'notdone')
      : 'na',
    // Falls back to n/a rather than "not done" when the field does not exist —
    // inventing a "not done" here would be reading a gap as a fact.
    hl7Vpn: usesHl7 ? (hl7Glyph(hl7VpnRaw) ?? 'notdone') : 'na',
    dicomStudy: usesDicom ? (subtaskGlyph(subtasks, DICOM_STUDY_MATCHERS) ?? 'notdone') : 'na',
    hl7Test: usesHl7 ? (hl7Glyph(hl7TestRaw) ?? subtaskGlyph(subtasks, HL7_TEST_MATCHERS) ?? 'notdone') : 'na',
    facility: facilityGlyph,
    station: stationGlyph,
    headerDotx: subtaskGlyph(subtasks, HEADER_DOTX_MATCHERS) ?? 'notdone',
  };

  const owner = task.assignees?.[0]?.username ?? null;
  const dateCreated = epochToIso(task.date_created);
  const newThisWeek = !!dateCreated && dateCreated.slice(0, 10) >= context.weekStart;

  const status = onHold
    ? 'watch'
    : deriveStatus({
        daysInPipeline,
        percentComplete,
        blockerGroup,
        owner,
        startDate,
        milestones: ms,
      });

  const estimatedDeployment = pendingFields.estimatedDeployment
    ? estimateFromField(rawValue(task, pendingFields.estimatedDeployment.id))
    : null;

  return {
    id: task.id,
    centerId: task.id,
    centerName: task.name.trim(),
    qualifier: buildQualifier(task, connectionType),
    connectionType,
    pacsVendor: textValue(task, FIELD.pacsVendor),
    owner,
    state: textValue(task, FIELD.states),
    locationCount: numberValue(task, FIELD.numberOfLocations),
    startDate,
    daysInPipeline,
    percentComplete,
    status,
    onHold,
    newThisWeek,
    urgent: hasTag(task, 'urgent') || task.priority?.priority === 'urgent',
    blockerGroup,
    blockerText: pendingContact ? `${labelFor(blockerGroup)} — ${pendingContact}` : null,
    waitingOn: pendingContact ? `${labelFor(blockerGroup)} — ${pendingContact}` : 'Not flagged',
    nextAction: null,
    estimatedDeployment: estimatedDeployment ?? (onHold ? { label: 'On hold', proposed: false } : null),
    ramsoftTicketId: textValue(task, FIELD.ramsoftVpnTicketId),
    milestones: ms,
    lineItems,
    finalFlag: onHold ? 'onhold' : isClosed(task) ? 'done' : 'notdone',
    lastActivityAt: epochToIso(task.date_updated),
    unsourced,
  };
}

function rawValue(task: ClickUpTask, fieldId: string): unknown {
  return task.custom_fields?.find((f) => f.id === fieldId)?.value;
}

function labelFor(group: BlockerGroupKey | null): string {
  switch (group) {
    case 'customer':
      return 'Customer';
    case 'ramsoft':
      return 'RamSoft';
    case 'internal':
      return 'Internal';
    case 'clientPacs':
      return 'Client PACS';
    case 'technosoft':
      return 'Technosoft';
    default:
      return 'Blocked';
  }
}

function resolveType(typeOfConnection: string | null, hl7Flag: string | null): string | null {
  const declared = typeOfConnection?.trim();
  if (declared) {
    if (/hl7/i.test(declared)) return 'HL7';
    if (/saas/i.test(declared)) return 'SaaS';
    if (/dicom/i.test(declared)) return 'DICOM';
    return declared;
  }
  if (hl7Flag && /^yes|true$/i.test(hl7Flag.trim())) return 'HL7';
  return null;
}

/** "OH · 3 loc" — the suffix after the center name on the summary view. */
function buildQualifier(task: ClickUpTask, connectionType: string | null): string | null {
  const parts: string[] = [];
  const state = textValue(task, FIELD.states);
  if (state) parts.push(state);
  if (connectionType && connectionType !== 'DICOM') parts.push(connectionType);

  const locations = numberValue(task, FIELD.numberOfLocations);
  if (locations && locations > 1) parts.push(`${locations} loc`);

  return parts.length > 0 ? parts.join(' · ') : null;
}

function estimateFromField(value: unknown): { label: string; proposed: boolean } | null {
  const ms = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  // A real date field means the date is committed — the asterisk comes off.
  return { label: new Date(ms).toISOString().slice(0, 10), proposed: false };
}

function daysBetween(startIso: string | null, todayIso: string): number | null {
  if (!startIso) return null;
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const today = Date.parse(`${todayIso}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(today)) return null;
  const days = Math.floor((today - start) / 86_400_000);
  return days >= 0 ? days : null;
}
