import { subDays, formatDistanceToNowStrict } from 'date-fns';

/** Maximum allowed span for an analytics date range, in days. */
export const MAX_RANGE_DAYS = 366;

/** Returns an ISO string for N days ago from now. */
export function daysAgo(n: number): string {
  return subDays(new Date(), n).toISOString();
}

/**
 * Returns a human-readable relative time string, e.g. "5 minutes ago",
 * "3 hours ago", "2 days ago".
 */
export function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  return formatDistanceToNowStrict(new Date(dateStr), { addSuffix: true });
}

/** Result of validating an analytics date range. */
export type DateRangeValidation =
  | { ok: true; start: Date; end: Date }
  | { ok: false; error: string };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Parses a date string, requiring an explicit timezone for full timestamps so
 * that timezone semantics are unambiguous. Date-only values are treated as UTC.
 */
function parseStrict(value: string): Date | null {
  if (!ISO_DATE_RE.test(value)) return null;
  const hasTime = value.includes('T') || value.includes(' ');
  const hasZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  if (hasTime && !hasZone) return null;
  const normalized = hasTime ? value.replace(' ', 'T') : `${value}T00:00:00Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Validates an analytics date range: format, ordering, maximum span, and
 * timezone semantics. Returns a normalized range or a descriptive error.
 */
export function validateDateRange(
  startRaw: string | null | undefined,
  endRaw: string | null | undefined,
  maxSpanDays: number = MAX_RANGE_DAYS,
): DateRangeValidation {
  if (!startRaw || !endRaw) {
    return { ok: false, error: 'Both start and end dates are required.' };
  }

  const start = parseStrict(startRaw);
  if (!start) {
    return { ok: false, error: 'Invalid start date format. Use ISO 8601 with an explicit timezone.' };
  }

  const end = parseStrict(endRaw);
  if (!end) {
    return { ok: false, error: 'Invalid end date format. Use ISO 8601 with an explicit timezone.' };
  }

  if (start.getTime() > end.getTime()) {
    return { ok: false, error: 'Start date must not be after end date.' };
  }

  const spanDays = (end.getTime() - start.getTime()) / 86_400_000;
  if (spanDays > maxSpanDays) {
    return { ok: false, error: `Date range must not exceed ${maxSpanDays} days.` };
  }

  return { ok: true, start, end };
}
