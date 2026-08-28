/**
 * Regression tests for the Do-Not-Disturb schedule (issue #870).
 *
 * DND schedules previously fired against the device-local wall clock instead
 * of the user's chosen IANA timezone, so they were wrong when the user
 * traveled and their wall-clock-to-window mapping drifted across DST
 * transitions.
 *
 * The device-local timezone is pinned to UTC (process.env.TZ) so the
 * assertions are deterministic no matter where the suite runs.
 */

process.env.TZ = 'UTC';

import {
  DEFAULT_PREFERENCES,
  type NotificationPreferences,
} from '@/types/notification';

import { getDeviceTimezone, getSupportedTimezones, isInDndWindow } from './dndSchedule';

function prefs(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    doNotDisturb: true,
    dndStart: '22:00',
    dndEnd: '08:00',
    timezone: 'America/New_York',
    ...overrides,
  };
}

describe('isInDndWindow — overnight window (22:00–08:00)', () => {
  it('returns false when DND is disabled', () => {
    expect(isInDndWindow(prefs({ doNotDisturb: false }), new Date('2026-01-15T07:00:00Z'))).toBe(
      false
    );
  });

  it('is active at the start boundary (22:00) and inactive at the end boundary (08:00)', () => {
    // 03:00 UTC = 22:00 EST in New York → DND just started
    expect(isInDndWindow(prefs(), new Date('2026-01-15T03:00:00Z'))).toBe(true);
    // 13:00 UTC = 08:00 EST in New York → DND just ended
    expect(isInDndWindow(prefs(), new Date('2026-01-15T13:00:00Z'))).toBe(false);
  });

  it('is active mid-window and inactive outside the window', () => {
    // 07:00 UTC = 02:00 EST in New York → quiet hours
    expect(isInDndWindow(prefs(), new Date('2026-01-15T07:00:00Z'))).toBe(true);
    // 17:00 UTC = 12:00 EST in New York → not quiet hours
    expect(isInDndWindow(prefs(), new Date('2026-01-15T17:00:00Z'))).toBe(false);
  });
});

describe('isInDndWindow — reproduces the timezone bug', () => {
  it('uses the preference timezone, not the device-local wall clock (device in UTC)', () => {
    // 02:00 UTC = 21:00 EST in New York → DND has not started there yet.
    // The buggy device-local implementation treats 02:00 as inside the
    // overnight window and would return true.
    expect(isInDndWindow(prefs(), new Date('2026-01-15T02:00:00Z'))).toBe(false);
  });
});

describe('isInDndWindow — travel keeps quiet hours in the home timezone', () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = 'Asia/Tokyo';
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  it('evaluates the window in America/New_York while the device is in Tokyo', () => {
    // 12:00 UTC = 21:00 JST on the device, but 07:00 EST in New York → DND active
    expect(isInDndWindow(prefs(), new Date('2026-01-15T12:00:00Z'))).toBe(true);
    // 02:00 UTC = 11:00 JST on the device, but 21:00 EST in New York → DND not yet active
    expect(isInDndWindow(prefs(), new Date('2026-01-15T02:00:00Z'))).toBe(false);
  });
});

describe('isInDndWindow — DST boundaries (America/New_York)', () => {
  describe('spring forward (2021-03-14, 02:00 EST jumps to 03:00 EDT)', () => {
    it('tracks the wall clock through the skipped hour', () => {
      // 06:30 UTC = 01:30 EST → active
      expect(isInDndWindow(prefs(), new Date('2021-03-14T06:30:00Z'))).toBe(true);
      // 07:30 UTC = 03:30 EDT → active
      expect(isInDndWindow(prefs(), new Date('2021-03-14T07:30:00Z'))).toBe(true);
      // 12:30 UTC = 08:30 EDT → window ended
      expect(isInDndWindow(prefs(), new Date('2021-03-14T12:30:00Z'))).toBe(false);
      // 02:30 UTC = 21:30 EST on 2021-03-13 → before the window
      expect(isInDndWindow(prefs(), new Date('2021-03-14T02:30:00Z'))).toBe(false);
    });
  });

  describe('fall back (2021-11-07, 02:00 EDT falls back to 01:00 EST)', () => {
    it('tracks the wall clock through the repeated hour', () => {
      // 05:30 UTC = 01:30 EDT (first pass) → active
      expect(isInDndWindow(prefs(), new Date('2021-11-07T05:30:00Z'))).toBe(true);
      // 06:30 UTC = 01:30 EST (second pass) → active
      expect(isInDndWindow(prefs(), new Date('2021-11-07T06:30:00Z'))).toBe(true);
      // 11:30 UTC = 07:30 EST → active
      expect(isInDndWindow(prefs(), new Date('2021-11-07T11:30:00Z'))).toBe(true);
      // 13:00 UTC = 08:00 EST → window ended
      expect(isInDndWindow(prefs(), new Date('2021-11-07T13:00:00Z'))).toBe(false);
    });
  });
});

describe('isInDndWindow — same-day window (09:00–17:00)', () => {
  const sameDay = prefs({ dndStart: '09:00', dndEnd: '17:00' });

  it('is active only between start and end in the preference timezone', () => {
    // 14:00 UTC = 09:00 EST → active (inclusive start)
    expect(isInDndWindow(sameDay, new Date('2026-01-15T14:00:00Z'))).toBe(true);
    // 22:00 UTC = 17:00 EST → inactive (exclusive end)
    expect(isInDndWindow(sameDay, new Date('2026-01-15T22:00:00Z'))).toBe(false);
    // 02:00 UTC = 21:00 EST → inactive
    expect(isInDndWindow(sameDay, new Date('2026-01-15T02:00:00Z'))).toBe(false);
  });
});

describe('isInDndWindow — malformed input and fallbacks', () => {
  it('falls back to device-local time when the timezone is invalid instead of throwing', () => {
    // Invalid IANA zone → device-local (UTC) wall clock is used: 07:00 is
    // inside the 22:00–08:00 overnight window.
    expect(
      isInDndWindow(prefs({ timezone: 'Not/AZone' }), new Date('2026-01-15T07:00:00Z'))
    ).toBe(true);
  });

  it('falls back to device-local time when no timezone is stored (legacy prefs)', () => {
    expect(isInDndWindow(prefs({ timezone: undefined }), new Date('2026-01-15T07:00:00Z'))).toBe(
      true
    );
  });

  it('treats malformed time strings as outside the window without throwing', () => {
    expect(isInDndWindow(prefs({ dndStart: 'later', dndEnd: 'earlier' }))).toBe(false);
  });
});

describe('timezone helpers', () => {
  it('returns a non-empty device timezone', () => {
    expect(getDeviceTimezone().length).toBeGreaterThan(0);
  });

  it('exposes a non-empty list of IANA timezones that always includes UTC', () => {
    const zones = getSupportedTimezones();
    expect(zones.length).toBeGreaterThan(0);
    expect(zones).toContain('UTC');
  });
});
