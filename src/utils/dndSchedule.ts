/**
 * Do-Not-Disturb schedule helpers.
 *
 * DND hours are evaluated against the user's chosen IANA timezone (stored in
 * NotificationPreferences.timezone) rather than the device's current wall
 * clock. This keeps the schedule correct when the user travels (device in a
 * different zone than their home zone) and across DST transitions, because
 * Intl.DateTimeFormat resolves the wall clock for the exact zone and instant.
 *
 * An overnight window (e.g. 22:00–08:00) spans midnight; a same-day window
 * (e.g. 09:00–17:00) does not. The window start is inclusive and the end is
 * exclusive, matching the previous behavior.
 */

import type { NotificationPreferences } from '@/types/notification';

export type DndPreferences = Pick<
  NotificationPreferences,
  'doNotDisturb' | 'dndStart' | 'dndEnd'
> & { timezone?: string };

/** Timezones guaranteed to be valid that some engines omit from supportedValuesOf. */
const ALWAYS_AVAILABLE_TIMEZONES = ['UTC', 'Etc/UTC'];

/**
 * The device's IANA timezone, falling back to 'UTC' when unavailable (e.g.
 * server-side rendering or an environment without timezone data).
 */
export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * All IANA timezones supported by the runtime, with 'UTC' guaranteed present.
 * Falls back to a small curated list on engines without Intl.supportedValuesOf.
 */
export function getSupportedTimezones(): string[] {
  const zones: string[] = [];
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.('timeZone');
    if (Array.isArray(supported)) zones.push(...supported);
  } catch {
    /* unsupported — use fallback below */
  }
  for (const tz of ALWAYS_AVAILABLE_TIMEZONES) {
    if (!zones.includes(tz)) zones.push(tz);
  }
  return zones.length ? zones : ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
}

/**
 * Returns true when `now` falls inside the DND window evaluated in the
 * preference timezone (or the device timezone when none is stored).
 */
export function isInDndWindow(prefs: DndPreferences, now: Date = new Date()): boolean {
  if (!prefs.doNotDisturb) return false;
  const start = parseTime(prefs.dndStart);
  const end = parseTime(prefs.dndEnd);
  const current = currentMinutes(prefs.timezone, now);
  if (start === null || end === null || current === null) return false;
  return start <= end
    ? current >= start && current < end
    : current >= start || current < end;
}

/** Parses "HH:MM" into minutes since midnight, or null for malformed input. */
function parseTime(value: string | undefined): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * Minutes since midnight of the wall clock at `now` in the given timezone.
 * An invalid timezone falls back to device-local time (the pre-fix behavior)
 * rather than throwing, so a corrupt stored value can never break the app.
 */
function currentMinutes(timezone: string | undefined, now: Date): number | null {
  const tz = timezone && timezone.trim() ? timezone.trim() : getDeviceTimezone();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const minute = parts.find((p) => p.type === 'minute')?.value;
    if (hour === undefined || minute === undefined) return null;
    return Number(hour) * 60 + Number(minute);
  } catch {
    try {
      return now.getHours() * 60 + now.getMinutes();
    } catch {
      return null;
    }
  }
}
