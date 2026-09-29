/**
 * Shared, timezone-aware date utilities for appointment views.
 *
 * All appointment instants are stored as UTC ISO strings. These helpers
 * centralize parsing/formatting so list, detail, calendar, and confirmation
 * views agree on the same instant, surface the appointment timezone, and
 * make DST gap/overlap behavior deterministic.
 */

export interface TimezoneInfo {
  /** IANA timezone identifier, e.g. "America/New_York". */
  timeZone: string;
  /** Human-friendly label, e.g. "America/New_York (EDT, UTC-4)". */
  label: string;
  /** Offset from UTC in minutes at the given instant (east positive). */
  offsetMinutes: number;
}

/**
 * Result of resolving a wall-clock time in a specific timezone.
 * `ambiguous` is true when the wall time occurs twice (DST overlap).
 * `nonexistent` is true when the wall time does not exist (DST gap).
 */
export interface WallTimeResolution {
  instant: Date | null;
  ambiguous: boolean;
  nonexistent: boolean;
  /** Candidate instants for an ambiguous wall time (earlier first). */
  candidates: Date[];
}

const MS_PER_MINUTE = 60 * 1000;

/** Parse a stored appointment value into a Date, or null when invalid. */
export function parseAppointmentInstant(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Offset (minutes, east positive) of `timeZone` at the given instant. */
export function getTimezoneOffsetMinutes(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  );
  return Math.round((asUtc - instant.getTime()) / MS_PER_MINUTE);
}

/** Describe a timezone at a given instant, including its current offset. */
export function describeTimezone(instant: Date, timeZone: string): TimezoneInfo {
  const offsetMinutes = getTimezoneOffsetMinutes(instant, timeZone);
  const short = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
    .formatToParts(instant)
    .find((p) => p.type === 'timeZoneName')?.value;
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const offsetLabel = `UTC${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${String(abs % 60).padStart(2, '0')}` : ''}`;
  return {
    timeZone,
    label: short ? `${timeZone} (${short}, ${offsetLabel})` : `${timeZone} (${offsetLabel})`,
    offsetMinutes,
  };
}

/** Format an appointment instant in the given timezone for display. */
export function formatAppointment(
  value: string | number | Date | null | undefined,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  const instant = parseAppointmentInstant(value);
  if (!instant) return '';
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(instant);
}

/**
 * Resolve a wall-clock time (as entered by a user) in a timezone to an
 * instant. Detects DST gaps (nonexistent) and overlaps (ambiguous) so callers
 * can require an explicit choice instead of silently shifting the time.
 */
export function resolveWallTime(
  wall: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
): WallTimeResolution {
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  const candidates: Date[] = [];
  // Probe a +/- 1 day window to catch both sides of a DST transition.
  for (let delta = -24 * 60; delta <= 24 * 60; delta += 15) {
    const probe = new Date(asUtc + delta * MS_PER_MINUTE);
    const offset = getTimezoneOffsetMinutes(probe, timeZone);
    const candidate = new Date(asUtc - offset * MS_PER_MINUTE);
    if (getTimezoneOffsetMinutes(candidate, timeZone) !== offset) continue;
    const local = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(candidate);
    const get = (type: string) => Number(local.find((p) => p.type === type)?.value ?? '0');
    if (
      get('year') === wall.year &&
      get('month') === wall.month &&
      get('day') === wall.day &&
      get('hour') % 24 === wall.hour &&
      get('minute') === wall.minute &&
      !candidates.some((c) => c.getTime() === candidate.getTime())
    ) {
      candidates.push(candidate);
    }
  }
  candidates.sort((a, b) => a.getTime() - b.getTime());
  if (candidates.length === 0) {
    return { instant: null, ambiguous: false, nonexistent: true, candidates: [] };
  }
  return {
    instant: candidates[0],
    ambiguous: candidates.length > 1,
    nonexistent: false,
    candidates,
  };
}

/**
 * Build the payload for an edit, preserving the instant plus its timezone.
 * Returns null when the input is invalid or ambiguous without an explicit
 * choice, so callers never submit silently. */
export function buildAppointmentEdit(
  wall: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
  chosenInstant?: Date,
): { instant: string; timeZone: string } | null {
  const resolution = resolveWallTime(wall, timeZone);
  if (resolution.nonexistent) return null;
  if (resolution.ambiguous && !chosenInstant) return null;
  const instant = chosenInstant ?? resolution.instant;
  if (!instant || Number.isNaN(instant.getTime())) return null;
  return { instant: instant.toISOString(), timeZone };
}

/** True when the user's browser timezone differs from the clinic timezone. */
export function timezonesDiffer(clinicTimeZone: string, userTimeZone?: string): boolean {
  const user = userTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return Boolean(user) && user !== clinicTimeZone;
}
