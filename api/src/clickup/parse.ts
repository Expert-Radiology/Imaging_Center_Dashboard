import type { ClickUpCustomField, ClickUpTask } from './client';

/** Read a custom field's raw value by id. */
export function rawField(task: ClickUpTask, fieldId: string): unknown {
  return task.custom_fields?.find((f) => f.id === fieldId)?.value;
}

export function fieldByName(
  fields: ClickUpCustomField[],
  candidates: readonly string[],
): ClickUpCustomField | null {
  const wanted = candidates.map((c) => c.toLowerCase());
  return (
    fields.find((f) => wanted.includes((f.name ?? '').trim().toLowerCase())) ?? null
  );
}

export function textValue(task: ClickUpTask, fieldId: string): string | null {
  const value = rawField(task, fieldId);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function numberValue(task: ClickUpTask, fieldId: string): number | null {
  const value = rawField(task, fieldId);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Dropdown values arrive as an option index or id; resolve to the option label. */
export function dropdownValue(task: ClickUpTask, fieldId: string): string | null {
  const field = task.custom_fields?.find((f) => f.id === fieldId);
  if (!field || field.value === null || field.value === undefined) return null;

  const options = field.type_config?.options ?? [];
  const label = (option: { name?: string; label?: string }) => option.name ?? option.label ?? null;

  if (typeof field.value === 'number') {
    const byIndex = options.find((o) => o.orderindex === field.value) ?? options[field.value];
    return byIndex ? label(byIndex) : null;
  }
  if (typeof field.value === 'string') {
    const byId = options.find((o) => o.id === field.value);
    if (byId) return label(byId);
    return field.value.trim() || null;
  }
  return null;
}

/** `Progress` is an automatic_progress field: `{ percent_complete: number }`. */
export function progressValue(task: ClickUpTask, fieldId: string): number | null {
  const value = rawField(task, fieldId);
  if (typeof value === 'number') return clampPercent(value);
  if (value && typeof value === 'object' && 'percent_complete' in value) {
    const percent = (value as { percent_complete?: unknown }).percent_complete;
    if (typeof percent === 'number') return clampPercent(percent);
  }
  return null;
}

function clampPercent(value: number): number {
  // ClickUp reports 0–100; some field types report 0–1.
  const percent = value <= 1 && value > 0 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

const NON_DATES = new Set(['n/a', 'na', 'none', 'tbd', 'unknown', '-', '']);

/**
 * `Date Start` is an AI-populated text field. It returns "05-12-2026", but also
 * "N/A" and "No client response found." Anything that is not an unambiguous
 * MM-DD-YYYY (or ISO) date yields null, and the dashboard renders a gap.
 */
export function parseDateStart(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (NON_DATES.has(trimmed.toLowerCase())) return null;
  // A sentence, not a date.
  if (/\s/.test(trimmed) && !/^\d/.test(trimmed)) return null;

  const usMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    return isoIfValid(Number(year), Number(month), Number(day));
  }

  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(trimmed);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return isoIfValid(Number(year), Number(month), Number(day));
  }

  return null;
}

function isoIfValid(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** ClickUp timestamps are epoch milliseconds as strings. */
export function epochToIso(value: string | undefined | null): string | null {
  if (!value) return null;
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

export function hasTag(task: ClickUpTask, name: string): boolean {
  return (task.tags ?? []).some((tag) => tag.name.toLowerCase() === name.toLowerCase());
}

export function isClosed(task: ClickUpTask): boolean {
  const status = task.status?.status?.toLowerCase();
  return task.status?.type === 'closed' || status === 'completed' || status === 'complete';
}
