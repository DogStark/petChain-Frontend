/**
 * Shared balance and currency formatting helpers.
 * Centralises Intl-based precision handling for Stellar XLM (up to 7 decimals),
 * crypto tokens, and standard ISO 4217 fiat currencies.
 */

export interface FormatNumberOptions extends Intl.NumberFormatOptions {
  fallback?: string;
}

const DEFAULT_FALLBACK = '—';

/**
 * Safely parses input to number, returning null if invalid or NaN.
 */
function toValidNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  return isNaN(num) ? null : num;
}

/**
 * Formats a fiat currency number (e.g. USD, EUR, GBP, JPY) using Intl.NumberFormat.
 */
export function formatCurrency(
  value: string | number | null | undefined,
  currency = 'USD',
  options?: FormatNumberOptions,
  locale?: string
): string {
  const num = toValidNumber(value);
  if (num === null) return options?.fallback ?? DEFAULT_FALLBACK;

  const { fallback, ...intlOptions } = options ?? {};
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      ...intlOptions,
    }).format(num);
  } catch {
    return fallback ?? DEFAULT_FALLBACK;
  }
}

/**
 * Formats a raw crypto / token balance (up to 7 decimal places for Stellar stroop precision).
 * Avoids scientific notation on small numbers.
 */
export function formatBalance(
  value: string | number | null | undefined,
  maximumFractionDigits = 7,
  locale?: string
): string {
  const num = toValidNumber(value);
  if (num === null) return DEFAULT_FALLBACK;

  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits,
      useGrouping: true,
    }).format(num);
  } catch {
    return DEFAULT_FALLBACK;
  }
}

/**
 * Formats a Stellar XLM balance with 'XLM' suffix and accurate fractional precision.
 */
export function formatStellar(
  value: string | number | null | undefined,
  options?: FormatNumberOptions,
  locale?: string
): string {
  const num = toValidNumber(value);
  if (num === null) return options?.fallback ?? DEFAULT_FALLBACK;

  const { fallback, ...intlOptions } = options ?? {};
  try {
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 7,
      ...intlOptions,
    }).format(num);
    return `${formatted} XLM`;
  } catch {
    return fallback ?? DEFAULT_FALLBACK;
  }
}

/**
 * Formats arbitrary crypto token balance with asset symbol suffix.
 */
export function formatCrypto(
  value: string | number | null | undefined,
  assetCode = 'XLM',
  options?: FormatNumberOptions,
  locale?: string
): string {
  const num = toValidNumber(value);
  if (num === null) return options?.fallback ?? DEFAULT_FALLBACK;

  const { fallback, ...intlOptions } = options ?? {};
  try {
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 7,
      ...intlOptions,
    }).format(num);
    return `${formatted} ${assetCode}`;
  } catch {
    return fallback ?? DEFAULT_FALLBACK;
  }
}

/**
 * Formats a plain number with locale separators.
 */
export function formatNumber(
  value: string | number | null | undefined,
  options?: FormatNumberOptions,
  locale?: string
): string {
  const num = toValidNumber(value);
  if (num === null) return options?.fallback ?? DEFAULT_FALLBACK;

  const { fallback, ...intlOptions } = options ?? {};
  try {
    return new Intl.NumberFormat(locale, intlOptions).format(num);
  } catch {
    return fallback ?? DEFAULT_FALLBACK;
  }
}

/**
 * Formats a percentage (0.15 -> "15%").
 */
export function formatPercent(
  value: string | number | null | undefined,
  options?: FormatNumberOptions,
  locale?: string
): string {
  const num = toValidNumber(value);
  if (num === null) return options?.fallback ?? DEFAULT_FALLBACK;

  const { fallback, ...intlOptions } = options ?? {};
  try {
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      ...intlOptions,
    }).format(num);
  } catch {
    return fallback ?? DEFAULT_FALLBACK;
  }
}
