import {
  flattenKeys,
  coverageRatio,
  resolveProfileLanguage,
  FALLBACK_LANGUAGE,
  type LanguageResolution,
} from '../profileLanguage';
import type { LanguageCode } from '@/i18n';

const REFERENCE = { a: 'x', b: { c: 'y' }, d: 'z' } as Record<string, unknown>;

describe('flattenKeys', () => {
  it('flattens nested objects into dot-paths', () => {
    const keys = flattenKeys(REFERENCE);
    expect(keys).toContain('a');
    expect(keys).toContain('b.c');
    expect(keys).toContain('d');
    expect(keys).toHaveLength(3);
  });

  it('indexes array leaves with bracket notation', () => {
    const keys = flattenKeys({ list: ['one', 'two'] });
    expect(keys).toContain('list[0]');
    expect(keys).toContain('list[1]');
  });

  it('returns the prefix for a bare leaf', () => {
    expect(flattenKeys('leaf', 'p')).toContain('p');
  });
});

describe('coverageRatio', () => {
  it('is 1 when target is identical to reference', () => {
    expect(coverageRatio(REFERENCE, REFERENCE)).toBe(1);
  });

  it('is the fraction of present reference keys', () => {
    const partial = { a: 'x', d: 'z' } as Record<string, unknown>;
    expect(coverageRatio(partial, REFERENCE)).toBeCloseTo(2 / 3, 5);
  });

  it('is 0 when the target is empty', () => {
    expect(coverageRatio({}, REFERENCE)).toBe(0);
  });

  it('is 1 when the reference itself is empty', () => {
    expect(coverageRatio({}, {})).toBe(1);
  });
});

describe('resolveProfileLanguage', () => {
  const full: Record<string, unknown> = REFERENCE;
  const partial: Record<string, unknown> = { a: 'x', d: 'z' };

  it('honours a fully translated supported locale', () => {
    const r: LanguageResolution = resolveProfileLanguage('en', REFERENCE, full);
    expect(r.requested).toBe('en');
    expect(r.resolved).toBe('en');
    expect(r.usedFallback).toBe(false);
    expect(r.isPartial).toBe(false);
    expect(r.coverage).toBe(1);
    expect(r.missingKeys).toBe(0);
  });

  it('falls back when a supported locale is too incomplete', () => {
    const r: LanguageResolution = resolveProfileLanguage('es', REFERENCE, partial, 0.9);
    expect(r.requested).toBe('es');
    expect(r.resolved).toBe(FALLBACK_LANGUAGE);
    expect(r.usedFallback).toBe(true);
    expect(r.isPartial).toBe(true);
    expect(r.coverage).toBeCloseTo(2 / 3, 5);
    expect(r.missingKeys).toBe(1);
  });

  it('falls back entirely for an unsupported locale', () => {
    const r: LanguageResolution = resolveProfileLanguage(
      'xx' as LanguageCode,
      REFERENCE,
      {},
    );
    expect(r.resolved).toBe(FALLBACK_LANGUAGE);
    expect(r.usedFallback).toBe(true);
    expect(r.coverage).toBe(0);
    expect(r.isPartial).toBe(true);
    expect(r.missingKeys).toBe(3);
  });

  it('treats coverage exactly at the threshold as complete (strict less-than)', () => {
    // reference has 10 keys, target has 9 -> coverage 0.9, threshold 0.9
    const ref = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`, 'v']));
    const tgt = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`k${i}`, 'v']));
    const atThreshold = resolveProfileLanguage('fr', ref, tgt, 0.9);
    expect(atThreshold.isPartial).toBe(false);
    expect(atThreshold.usedFallback).toBe(false);

    const below = resolveProfileLanguage('fr', ref, Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`k${i}`, 'v'])), 0.9);
    expect(below.isPartial).toBe(true);
    expect(below.usedFallback).toBe(true);
  });
});
