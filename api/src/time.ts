/**
 * HQ-time helpers, mirroring src/lib/week.ts on the client.
 *
 * Both sides compute in America/Puerto_Rico so the Function's week boundary and
 * the browser's header never disagree.
 */
export const HQ_TIMEZONE = 'America/Puerto_Rico';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Today's calendar date in Puerto Rico, ISO. */
export function hqToday(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HQ_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
  return parts; // en-CA formats as YYYY-MM-DD
}

/** The Monday of the week containing `isoDate`. */
export function weekStartFor(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  const weekday = date.getUTCDay();
  const offset = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

/** `weekStart` shifted by `weeks`, optionally plus extra days. */
export function addWeeks(weekStart: string, weeks: number, extraDays = 0): string {
  const date = new Date(`${weekStart}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + weeks * 7 + extraDays);
  return date.toISOString().slice(0, 10);
}

/** "Week of Sep 1 – Sep 7, 2026" */
export function weekLabelFor(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return `Week of ${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()} – ${MONTHS[end.getUTCMonth()]} ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
}

/** "Sep 1 – 7" / "Sep 29 – Oct 5" */
export function weekRangeLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);

  const startLabel = `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const endLabel =
    start.getUTCMonth() === end.getUTCMonth()
      ? String(end.getUTCDate())
      : `${MONTHS[end.getUTCMonth()]} ${end.getUTCDate()}`;
  return `${startLabel} – ${endLabel}`;
}
