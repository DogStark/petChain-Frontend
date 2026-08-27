/**
 * Shared date/datetime formatting helpers.
 * All call sites should use these instead of inline new Date(...).toLocaleString().
 */

const LOCALE = undefined; // use browser default locale

export function formatDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString(LOCALE);
}

export function formatDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString(LOCALE);
}
