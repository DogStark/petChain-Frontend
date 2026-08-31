/**
 * Stroop-safe Stellar amount handling.
 *
 * Stellar amounts are denominated in stroops where 1 XLM = 10,000,000 stroops.
 * JavaScript `number` arithmetic can silently round amounts (e.g. 0.1 + 0.2),
 * so all amount arithmetic performed by the app uses validated decimal strings
 * converted to integer stroops. This module is the single source of truth for
 * that conversion and for amount validation.
 */

const STROOPS_PER_XLM = 10_000_000n;

/**
 * Largest stroop value that is still exactly representable as a JS number
 * (Number.MAX_SAFE_INTEGER). Amounts above this are rejected rather than risk
 * silent rounding during conversion or comparison.
 */
export const MAX_SAFE_STROOPS = 9_007_199_254_740_991n;

/**
 * Canonical decimal form: 1-15 integer digits and at most 7 decimal places.
 * No signs, no exponents, no scientific notation, no thousands separators.
 */
const AMOUNT_PATTERN = /^\d{1,15}(?:\.\d{1,7})?$/;

/**
 * Validates a Stellar amount string and converts it to integer stroops.
 *
 * @throws Error if the string is not a canonical positive decimal amount with
 *         at most 7 decimal places, or if it exceeds the safe stroop range.
 */
export function toStroops(amount: string): number {
  const trimmed = typeof amount === 'string' ? amount.trim() : '';
  if (!AMOUNT_PATTERN.test(trimmed)) {
    throw new Error('Amount must be a decimal number with up to 7 decimal places.');
  }

  const [whole, fraction = ''] = trimmed.split('.');
  const fractionPadded = fraction.padEnd(7, '0');
  const stroops = BigInt(whole) * STROOPS_PER_XLM + BigInt(fractionPadded);

  if (stroops === 0n) {
    throw new Error('Amount must be greater than zero.');
  }
  if (stroops > MAX_SAFE_STROOPS) {
    throw new Error('Amount exceeds the maximum supported value.');
  }

  return Number(stroops);
}

/**
 * Returns true when `amount` is a canonical positive Stellar amount string
 * (decimal, up to 7 places, within the safe stroop range).
 */
export function isValidStellarAmount(amount: string): boolean {
  try {
    return toStroops(amount) > 0;
  } catch {
    return false;
  }
}

/**
 * Converts integer stroops to a canonical 7-decimal XLM string, e.g. "1.0000000".
 * Never uses floating point, so the result is exact.
 */
export function stroopsToXlm(stroops: string | number): string {
  const value = BigInt(stroops);
  if (value < 0n) {
    throw new Error('Stroop value must be non-negative.');
  }
  const whole = value / STROOPS_PER_XLM;
  const fraction = value % STROOPS_PER_XLM;
  return `${whole.toString()}.${fraction.toString().padStart(7, '0')}`;
}

/**
 * Compares two canonical Stellar amount strings without floating point.
 * Returns a negative number when a < b, 0 when equal, positive when a > b.
 *
 * @throws Error if either amount is not a valid canonical amount.
 */
export function compareStellarAmounts(a: string, b: string): number {
  return toStroops(a) - toStroops(b);
}

/**
 * Like {@link toStroops} but returns `null` instead of throwing, for use in
 * validation paths where a friendly error message is produced by the caller.
 */
export function amountToStroopsOrNull(amount: string): number | null {
  try {
    return toStroops(amount);
  } catch {
    return null;
  }
}
