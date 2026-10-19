import {
  formatDate,
  formatDateTime,
  formatTime,
  formatAppointmentDate,
  formatRelativeTime,
  isValidDate,
} from './formatDate';

describe('formatDate utility', () => {
  const sampleIso = '2026-06-15T14:30:00.000Z';
  const sampleTimestamp = 1781533800000; // 2026-06-15T14:30:00.000Z
  const sampleDate = new Date(sampleIso);

  describe('isValidDate', () => {
    it('returns true for valid dates, strings, and numbers', () => {
      expect(isValidDate(sampleIso)).toBe(true);
      expect(isValidDate(sampleTimestamp)).toBe(true);
      expect(isValidDate(sampleDate)).toBe(true);
      expect(isValidDate(0)).toBe(true);
    });

    it('returns false for invalid inputs', () => {
      expect(isValidDate('not-a-date')).toBe(false);
      expect(isValidDate(NaN)).toBe(false);
      expect(isValidDate(null as any)).toBe(false);
      expect(isValidDate(undefined as any)).toBe(false);
      expect(isValidDate('')).toBe(false);
    });
  });

  describe('formatDate', () => {
    it('formats ISO strings, timestamps, and Date instances in en-US locale', () => {
      const resIso = formatDate(sampleIso, { timeZone: 'UTC' }, 'en-US');
      const resTs = formatDate(sampleTimestamp, { timeZone: 'UTC' }, 'en-US');
      const resDate = formatDate(sampleDate, { timeZone: 'UTC' }, 'en-US');

      expect(resIso).toBe('6/15/2026');
      expect(resTs).toBe('6/15/2026');
      expect(resDate).toBe('6/15/2026');
    });

    it('supports multiple locales (de-DE, ja-JP, es-ES, fr-FR)', () => {
      expect(formatDate(sampleIso, { timeZone: 'UTC' }, 'de-DE')).toContain('15.6.2026');
      expect(formatDate(sampleIso, { timeZone: 'UTC' }, 'ja-JP')).toBe('2026/6/15');
      expect(formatDate(sampleIso, { timeZone: 'UTC' }, 'fr-FR')).toBe('15/06/2026');
    });

    it('handles invalid inputs gracefully without throwing', () => {
      expect(formatDate('invalid-date')).toBe('—');
      expect(formatDate(null as any)).toBe('—');
      expect(formatDate(undefined as any)).toBe('—');
      expect(formatDate(NaN)).toBe('—');
      expect(formatDate('', { fallback: 'N/A' })).toBe('N/A');
    });

    it('accepts standard Intl.DateTimeFormatOptions', () => {
      const formatted = formatDate(
        sampleIso,
        { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' },
        'en-US'
      );
      expect(formatted).toBe('June 15, 2026');
    });
  });

  describe('formatDateTime', () => {
    it('formats date and time with timezone awareness', () => {
      const utc = formatDateTime(sampleIso, { timeZone: 'UTC' }, 'en-US');
      expect(utc).toContain('2026');
      expect(utc).toContain('2:30');

      const tokyo = formatDateTime(sampleIso, { timeZone: 'Asia/Tokyo' }, 'en-US');
      // UTC 14:30 is Tokyo 23:30
      expect(tokyo).toContain('11:30');
    });

    it('handles invalid inputs gracefully', () => {
      expect(formatDateTime('not-valid')).toBe('—');
      expect(formatDateTime(null as any)).toBe('—');
    });
  });

  describe('formatTime', () => {
    it('formats time component with timezone', () => {
      const utcTime = formatTime(sampleIso, { timeZone: 'UTC' }, 'en-US');
      expect(utcTime).toMatch(/2:30:00\s*(PM|pm)?/);
    });

    it('handles invalid inputs gracefully', () => {
      expect(formatTime('invalid')).toBe('—');
    });
  });

  describe('formatAppointmentDate', () => {
    it('formats appointment with date, time, and timezone abbreviation/name', () => {
      const result = formatAppointmentDate(sampleIso, 'UTC', 'en-US');
      expect(result).toContain('Jun 15, 2026');
      expect(result).toContain('2:30 PM');
      expect(result).toContain('UTC');
    });

    it('formats appointment across timezones accurately', () => {
      const resultNy = formatAppointmentDate(sampleIso, 'America/New_York', 'en-US');
      // UTC 14:30 is EDT 10:30 AM (UTC-4)
      expect(resultNy).toContain('Jun 15, 2026');
      expect(resultNy).toContain('10:30 AM');
      expect(resultNy).toMatch(/(EDT|GMT-4|UTC-4)/);
    });

    it('handles invalid inputs gracefully', () => {
      expect(formatAppointmentDate('invalid-date')).toBe('—');
    });
  });

  describe('formatRelativeTime', () => {
    it('formats past and future relative times', () => {
      const base = new Date('2026-06-15T12:00:00.000Z');
      const twoHoursAgo = new Date('2026-06-15T10:00:00.000Z');
      const threeDaysLater = new Date('2026-06-18T12:00:00.000Z');

      expect(formatRelativeTime(twoHoursAgo, base, 'en-US')).toBe('2 hours ago');
      expect(formatRelativeTime(threeDaysLater, base, 'en-US')).toBe('in 3 days');
    });

    it('handles invalid relative time input', () => {
      expect(formatRelativeTime('invalid')).toBe('—');
    });
  });
});
