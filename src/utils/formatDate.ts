/**
 * Locale-aware date formatting utilities.
 *
 * All formatting derives its locale from the i18n context (see `src/i18n/config.ts`).
 * Supported locales: en, es, fr, de, pt, it, nl, ja, zh, ar.
 */

export type SupportedLocale =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'it'
  | 'nl'
  | 'ja'
  | 'zh'
  | 'ar';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = [
  'en',
  'es',
  'fr',
  'de',
  'pt',
  'it',
  'nl',
  'ja',
  'zh',
  'ar',
] as const;

const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * Normalize an arbitrary locale string (e.g. "en-US", "fr_FR") to one of the
 * supported locales, falling back to English when unknown.
 */
export function normalizeLocale(locale?: string | null): SupportedLocale {
  if (!locale) return DEFAULT_LOCALE;
  const base = locale.toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(base)
    ? (base as SupportedLocale)
    : DEFAULT_LOCALE;
}

function toDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format an absolute date using the user's locale.
 *
 * @example
 * formatDate(new Date('2024-03-05'), 'en'); // "3/5/2024"
 * formatDate(new Date('2024-03-05'), 'fr'); // "05/03/2024"
 */
export function formatDate(
  value: Date | string | number,
  locale?: string | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = toDate(value);
  if (!date) return '';
  const resolved = normalizeLocale(locale);
  return new Intl.DateTimeFormat(resolved, options ?? {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Format a date with time using the user's locale.
 */
export function formatDateTime(
  value: Date | string | number,
  locale?: string | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = toDate(value);
  if (!date) return '';
  const resolved = normalizeLocale(locale);
  return new Intl.DateTimeFormat(resolved, options ?? {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format a date relative to now (e.g. "2 days ago") using the user's locale.
 */
export function formatRelativeDate(
  value: Date | string | number,
  locale?: string | null,
  now: Date = new Date(),
): string {
  const date = toDate(value);
  if (!date) return '';
  const resolved = normalizeLocale(locale);
  const diffMs = date.getTime() - now.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(resolved, { numeric: 'auto' });

  if (Math.abs(diffSeconds) < 60) return rtf.format(diffSeconds, 'second');
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  if (Math.abs(diffDays) < 30) return rtf.format(diffDays, 'day');
  if (Math.abs(diffDays) < 365) return rtf.format(Math.round(diffDays / 30), 'month');
  return rtf.format(Math.round(diffDays / 365), 'year');
}
