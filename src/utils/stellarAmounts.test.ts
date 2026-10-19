/**
 * Tests for stroop-safe Stellar amount handling (issue #855).
 * Amount arithmetic must never rely on floating-point `number` math.
 */
import {
  toStroops,
  isValidStellarAmount,
  stroopsToXlm,
  compareStellarAmounts,
  amountToStroopsOrNull,
  MAX_SAFE_STROOPS,
} from './stellarAmounts';

describe('toStroops', () => {
  it('converts whole XLM to stroops exactly', () => {
    expect(toStroops('1')).toBe(10_000_000);
    expect(toStroops('2.5')).toBe(25_000_000);
  });

  it('treats 1 stroop as the minimum precision unit', () => {
    expect(toStroops('0.0000001')).toBe(1);
  });

  it('rejects more than 7 decimal places', () => {
    expect(() => toStroops('0.00000001')).toThrow(/7 decimal places/);
  });

  it('rejects zero and empty amounts', () => {
    expect(() => toStroops('0')).toThrow(/greater than zero/);
    expect(() => toStroops('0.0000000')).toThrow(/greater than zero/);
    expect(() => toStroops('')).toThrow(/decimal/);
  });

  it('rejects negative amounts and signs', () => {
    expect(() => toStroops('-1')).toThrow(/decimal/);
    expect(() => toStroops('+1')).toThrow(/decimal/);
  });

  it('rejects exponent notation, commas, and whitespace', () => {
    expect(() => toStroops('1e7')).toThrow(/decimal/);
    expect(() => toStroops('1,000')).toThrow(/decimal/);
    expect(() => toStroops('1.')).toThrow(/decimal/);
    expect(() => toStroops('.5')).toThrow(/decimal/);
  });

  it('accepts exactly MAX_SAFE_STROOPS and rejects one stroop more', () => {
    expect(toStroops('900719925.4740991')).toBe(Number(MAX_SAFE_STROOPS));
    expect(() => toStroops('900719925.4740992')).toThrow(/maximum supported/);
  });

  it('is idempotent for canonical boundary values', () => {
    expect(toStroops('0.1') + toStroops('0.2')).toBe(toStroops('0.3'));
  });
});

describe('isValidStellarAmount', () => {
  it('accepts canonical positive amounts', () => {
    expect(isValidStellarAmount('0.0000001')).toBe(true);
    expect(isValidStellarAmount('10')).toBe(true);
    expect(isValidStellarAmount('123.4567890')).toBe(true);
  });

  it('rejects malformed amounts', () => {
    expect(isValidStellarAmount('')).toBe(false);
    expect(isValidStellarAmount('0')).toBe(false);
    expect(isValidStellarAmount('-5')).toBe(false);
    expect(isValidStellarAmount('NaN')).toBe(false);
    expect(isValidStellarAmount('Infinity')).toBe(false);
    expect(isValidStellarAmount('1.00000001')).toBe(false);
  });
});

describe('stroopsToXlm', () => {
  it('formats stroops with exactly 7 decimal places', () => {
    expect(stroopsToXlm(1)).toBe('0.0000001');
    expect(stroopsToXlm(10_000_000)).toBe('1.0000000');
  });

  it('handles large and string inputs without float rounding', () => {
    expect(stroopsToXlm(12_345_678_901_234)).toBe('1234567.8901234');
    expect(stroopsToXlm('100')).toBe('0.0000100');
  });

  it('rejects negative stroop values', () => {
    expect(() => stroopsToXlm(-1)).toThrow(/non-negative/);
  });

  it('round-trips canonical amounts', () => {
    expect(toStroops(stroopsToXlm(25_000_000))).toBe(25_000_000);
  });
});

describe('compareStellarAmounts', () => {
  it('treats equivalent decimal representations as equal', () => {
    expect(compareStellarAmounts('0.5', '0.50')).toBe(0);
    expect(compareStellarAmounts('1', '1.0000000')).toBe(0);
  });

  it('compares without floating point', () => {
    expect(compareStellarAmounts('1', '0.9999999')).toBeGreaterThan(0);
    expect(compareStellarAmounts('0.0000001', '0.0000002')).toBeLessThan(0);
  });

  it('throws on invalid input', () => {
    expect(() => compareStellarAmounts('abc', '1')).toThrow();
  });
});

describe('amountToStroopsOrNull', () => {
  it('returns null instead of throwing for invalid input', () => {
    expect(amountToStroopsOrNull('nope')).toBeNull();
    expect(amountToStroopsOrNull('0')).toBeNull();
    expect(amountToStroopsOrNull('1.5')).toBe(15_000_000);
  });
});
