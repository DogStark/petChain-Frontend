/**
 * Shared balance/currency formatting helpers.
 * Centralises locale and decimal-precision handling for XLM and USD values.
 */

const LOCALE = undefined; // use browser default locale

/** Format a raw XLM/token balance string or number (up to 7 decimal places). */
export function formatBalance(
  value: string | number,
  maximumFractionDigits = 7
): string {
  return parseFloat(String(value)).toLocaleString(LOCALE, { maximumFractionDigits });
}

/** Format a currency number (e.g. USD) with 2 decimal places. */
export function formatCurrency(value: string | number): string {
  return Number(value).toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
