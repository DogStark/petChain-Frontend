import { buildQrAccessHistory, RawAccessEntry } from '../qrAccessHistory';

describe('buildQrAccessHistory', () => {
  const entry = (over: Partial<RawAccessEntry> = {}): RawAccessEntry => ({
    timestamp: '2026-10-25T12:34:56.000Z',
    region: 'EU',
    scannerId: 'scanner-xyz',
    scannerName: 'Front Desk Kiosk',
    latitude: 12.34,
    longitude: 56.78,
    city: 'Berlin',
    ip: '203.0.113.9',
    ...over,
  });

  it('strips scanner identity and precise location, keeping only coarse bucket + region', () => {
    const r = buildQrAccessHistory([entry()]);
    expect(r.count).toBe(1);
    expect(r.hasEntries).toBe(true);
    const e = r.entries[0];
    expect(e.region).toBe('EU');
    expect(e.regionAvailable).toBe(true);
    // coarse hourly bucket, no precise time
    expect(e.bucketLabel).toMatch(/^2026-10-25 12:00 UTC$/);
    // never exposes identity / precise location
    const serialized = JSON.stringify(r);
    expect(serialized).not.toMatch(/scanner-xyz/);
    expect(serialized).not.toMatch(/Front Desk Kiosk/);
    expect(serialized).not.toMatch(/12\.34/);
    expect(serialized).not.toMatch(/Berlin/);
    expect(serialized).not.toMatch(/203\.0\.113\.9/);
  });

  it('buckets timestamps to the hour regardless of minutes/seconds', () => {
    const r = buildQrAccessHistory([
      { timestamp: '2026-10-25T12:05:00.000Z', region: 'US' },
      { timestamp: '2026-10-25T12:59:59.000Z', region: 'US' },
      { timestamp: '2026-10-25T13:00:00.000Z', region: 'US' },
    ]);
    expect(r.count).toBe(3);
    const buckets = r.entries.map((e) => e.bucketLabel);
    expect(buckets).toEqual([
      '2026-10-25 12:00 UTC',
      '2026-10-25 12:00 UTC',
      '2026-10-25 13:00 UTC',
    ]);
  });

  it('accepts epoch milliseconds and floors to UTC hour', () => {
    const ms = Date.UTC(2026, 9, 25, 9, 42, 11); // 2026-10-25 09:42:11 UTC
    const r = buildQrAccessHistory([{ timestamp: ms, region: 'APAC' }]);
    expect(r.entries[0].bucketLabel).toBe('2026-10-25 09:00 UTC');
  });

  it('treats a missing region as not recorded rather than empty string', () => {
    const r = buildQrAccessHistory([
      { timestamp: '2026-10-25T12:00:00.000Z', region: null },
      { timestamp: '2026-10-25T13:00:00.000Z', region: '   ' },
    ]);
    expect(r.entries[0].regionAvailable).toBe(false);
    expect(r.entries[0].region).toBeNull();
    expect(r.entries[1].regionAvailable).toBe(false);
    expect(r.note).toMatch(/not recorded/i);
  });

  it('handles empty / null / undefined input as "no scans yet"', () => {
    expect(buildQrAccessHistory([]).summary).toMatch(/no one has scanned/i);
    expect(buildQrAccessHistory(null).hasEntries).toBe(false);
    expect(buildQrAccessHistory(undefined).count).toBe(0);
  });

  it('reports a denied state without exposing any entries', () => {
    const r = buildQrAccessHistory([entry()], { denied: true });
    expect(r.denied).toBe(true);
    expect(r.hasEntries).toBe(false);
    expect(r.count).toBe(0);
    expect(r.entries).toEqual([]);
    expect(r.summary).toMatch(/turned off/i);
  });

  it('does not throw on malformed timestamps', () => {
    const r = buildQrAccessHistory([
      { timestamp: 'not-a-date', region: 'EU' },
      { timestamp: NaN, region: 'US' },
      { timestamp: '', region: 'APAC' },
    ]);
    expect(r.count).toBe(3);
    r.entries.forEach((e) => expect(e.bucketLabel).toBe('Unknown time'));
    expect(r.entries[2].region).toBe('APAC');
  });

  it('summarises the scan count in a colour-independent way', () => {
    const one = buildQrAccessHistory([{ timestamp: '2026-10-25T12:00:00.000Z', region: 'EU' }]);
    expect(one.summary).toMatch(/1 scan/i);
    const many = buildQrAccessHistory([
      { timestamp: '2026-10-25T12:00:00.000Z', region: 'EU' },
      { timestamp: '2026-10-25T13:00:00.000Z', region: 'US' },
    ]);
    expect(many.summary).toMatch(/2 scans/i);
  });
});
