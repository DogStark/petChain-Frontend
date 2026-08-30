/**
 * Shared locale-aware date/datetime/time formatting helpers.
 * Centralises Intl.DateTimeFormat configuration, timezone handling,
 * error boundaries, and locale fallback.
 */

export interface FormatDateOptions extends Intl.DateTimeFormatOptions {
  fallback?: string;
}

const DEFAULT_FALLBACK = '—';

/**
 * Validates whether a given input is a valid Date or timestamp representation.
 */
export function isValidDate(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return !isNaN(date.getTime());
}

/**
 * Coerces input into a Date object if valid, or returns null.
 */
function toValidDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a date string, timestamp, or Date instance into a locale-aware date.
 */
export function formatDate(
  value: string | number | Date | null | undefined,
  options?: FormatDateOptions,
  locale?: string
): string {
  const date = toValidDate(value);
  if (!date) return options?.fallback ?? DEFAULT_FALLBACK;

  const { fallback, ...intlOptions } = options ?? {};
  try {
    return new Intl.DateTimeFormat(locale, intlOptions).format(date);
  } catch {
    return fallback ?? DEFAULT_FALLBACK;
  }
}

/**
 * Formats a date string, timestamp, or Date instance into a locale-aware date and time.
 */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  options?: FormatDateOptions,
  locale?: string
): string {
  const date = toValidDate(value);
  if (!date) return options?.fallback ?? DEFAULT_FALLBACK;

  const { fallback, ...intlOptions } = options ?? {};
  const defaultOptions: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...intlOptions,
  };

  try {
    return new Intl.DateTimeFormat(locale, defaultOptions).format(date);
  } catch {
    return fallback ?? DEFAULT_FALLBACK;
  }
}

/**
 * Formats time component only.
 */
export function formatTime(
  value: string | number | Date | null | undefined,
  options?: FormatDateOptions,
  locale?: string
): string {
  const date = toValidDate(value);
  if (!date) return options?.fallback ?? DEFAULT_FALLBACK;

  const { fallback, ...intlOptions } = options ?? {};
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeStyle: 'medium',
    ...intlOptions,
  };

  try {
    return new Intl.DateTimeFormat(locale, defaultOptions).format(date);
  } catch {
    return fallback ?? DEFAULT_FALLBACK;
  }
}

/**
 * Specialized appointment date formatter displaying date, time, and timezone.
 */
export function formatAppointmentDate(
  value: string | number | Date | null | undefined,
  timeZone?: string,
  locale?: string
): string {
  const date = toValidDate(value);
  if (!date) return DEFAULT_FALLBACK;

  try {
    const formatted = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone: timeZone || undefined,
    }).format(date);
    return formatted;
  } catch {
    return DEFAULT_FALLBACK;
  }
}

/**
 * Relative time formatter (e.g. "2 hours ago", "in 3 days").
 */
export function formatRelativeTime(
  value: string | number | Date | null | undefined,
  baseDate: Date = new Date(),
  locale?: string
): string {
  const date = toValidDate(value);
  if (!date) return DEFAULT_FALLBACK;

  try {
    const diffMs = date.getTime() - baseDate.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHours = Math.round(diffMin / 60);
    const diffDays = Math.round(diffHours / 24);

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    if (Math.abs(diffDays) >= 1) {
      return rtf.format(diffDays, 'day');
    }
    if (Math.abs(diffHours) >= 1) {
      return rtf.format(diffHours, 'hour');
    }
    if (Math.abs(diffMin) >= 1) {
      return rtf.format(diffMin, 'minute');
    }
    return rtf.format(diffSec, 'second');
  } catch {
    return DEFAULT_FALLBACK;
  }
}
