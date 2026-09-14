/**
 * Renders a "calendar date" field (execution date, report date, last run
 * date, ...) without the off-by-one that happens for timezones west of UTC.
 *
 * These fields come from a plain <input type="date"> ("2026-08-08") that the
 * API stores as UTC midnight ("2026-08-08T00:00:00.000Z"). Calling
 * `new Date(value).toLocaleDateString()` directly then converts that UTC
 * instant to the browser's local timezone before formatting — for
 * America/Bogota (UTC-5) that lands on 2026-08-07T19:00 local, so the date
 * silently shows one day earlier than what was actually entered/stored.
 *
 * Fix: read the UTC year/month/day the value was built from, then build a
 * *local* Date from those same numbers before formatting, so the calendar
 * day displayed always matches the day that was saved.
 */
export function formatDateOnly(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return local.toLocaleDateString();
}
