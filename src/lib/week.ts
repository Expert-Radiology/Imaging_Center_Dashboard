/**
 * All dates on this dashboard are company-HQ dates, not viewer-local ones.
 *
 * Technosoft partners in Pakistan are cc'd on this work; on their clock the
 * week would roll over a day early and the header would disagree with the
 * meeting it is being shown in.
 */
export const HQ_TIMEZONE = 'America/Puerto_Rico';

interface ZonedDate {
  year: number;
  month: number; // 1-12
  day: number;
  /** 0 = Sunday */
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** The calendar date in Puerto Rico at instant `at`. */
export function hqDate(at: Date = new Date()): ZonedDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HQ_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(at);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
  };
}

/** MM.DD.YY — the header's date stamp. */
export function formatHeaderDate(at: Date = new Date()): string {
  const { year, month, day } = hqDate(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(month)}.${pad(day)}.${String(year).slice(-2)}`;
}

/** Treat a Y-M-D triple as a UTC instant so day arithmetic never crosses a DST seam. */
function toUtcMidnight({ year, month, day }: Pick<ZonedDate, 'year' | 'month' | 'day'>): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface WeekWindow {
  start: string;
  end: string;
  label: string;
}

/** The Monday–Sunday week containing `at`, in HQ time. */
export function currentWeek(at: Date = new Date()): WeekWindow {
  const today = hqDate(at);
  const base = toUtcMidnight(today);
  // Monday-first: Sunday (0) belongs to the week that started six days earlier.
  const offsetToMonday = today.weekday === 0 ? 6 : today.weekday - 1;

  const start = new Date(base);
  start.setUTCDate(start.getUTCDate() - offsetToMonday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);

  return { start: isoDay(start), end: isoDay(end), label: weekLabel(start, end) };
}

function weekLabel(start: Date, end: Date): string {
  const s = `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const e = `${MONTHS[end.getUTCMonth()]} ${end.getUTCDate()}`;
  return `Week of ${s} – ${e}, ${end.getUTCFullYear()}`;
}

/** "Sep 1 – 7" / "Sep 29 – Oct 5" — the throughput column headers. */
export function weekRangeLabel(startIso: string): string {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);

  const startLabel = `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const endLabel =
    start.getUTCMonth() === end.getUTCMonth()
      ? String(end.getUTCDate())
      : `${MONTHS[end.getUTCMonth()]} ${end.getUTCDate()}`;

  return `${startLabel} – ${endLabel}`;
}

/** Whole days between two calendar dates, or null when the start is unusable. */
export function daysBetween(startIso: string | null, at: Date = new Date()): number | null {
  if (!startIso) return null;
  const start = new Date(`${startIso}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  const today = toUtcMidnight(hqDate(at));
  const days = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

/** "3 minutes ago" / "just now" — the freshness caption. */
export function relativeTime(iso: string, at: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown';
  const seconds = Math.max(0, Math.round((at.getTime() - then) / 1000));

  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
