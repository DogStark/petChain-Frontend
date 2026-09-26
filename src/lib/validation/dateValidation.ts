/**
 * Date validation utilities for medical records and appointments.
 *
 * All comparisons are performed in UTC to avoid timezone-related
 * silent shifts that could turn a valid date into an invalid one.
 *
 * Policy:
 *  - Dates must not be in the future (exact boundary: today is allowed).
 *  - A date must not be before the pet's date of birth.
 *  - Visit/diagnosis/treatment/expiry dates must be in non-decreasing order.
 */

/**
 * Parse a YYYY-MM-DD string as a UTC date so that timezone offsets
 * cannot shift the calendar day.
 */
function parseDateUTC(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Returns true if the given date string (YYYY-MM-DD) is in the future.
 * "Today" is not considered future.
 */
export function isFutureDate(dateStr: string): boolean {
  const date = parseDateUTC(dateStr);
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return date > todayUTC;
}

/**
 * Returns true if the given date is before the birth date.
 */
export function isBeforeBirth(dateStr: string, birthDateStr: string): boolean {
  const date = parseDateUTC(dateStr);
  const birth = parseDateUTC(birthDateStr);
  return date < birth;
}

/**
 * Returns true if the given date is after the expiry date.
 */
export function isAfterExpiry(dateStr: string, expiryDateStr: string): boolean {
  const date = parseDateUTC(dateStr);
  const expiry = parseDateUTC(expiryDateStr);
  return date > expiry;
}

/**
 * Validates that a date is not in the future.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateNotFuture(dateStr: string, fieldName: string): string | null {
  if (!dateStr) return null;
  if (isFutureDate(dateStr)) {
    return `${fieldName} cannot be in the future`;
  }
  return null;
}

/**
 * Validates that a date is not before the pet's birth date.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateAfterBirth(
  dateStr: string,
  birthDateStr: string,
  fieldName: string,
): string | null {
  if (!dateStr || !birthDateStr) return null;
  if (isBeforeBirth(dateStr, birthDateStr)) {
    return `${fieldName} must be after the pet's birth date`;
  }
  return null;
}

/**
 * Validates that a date is not after the expiry date.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateBeforeExpiry(
  dateStr: string,
  expiryDateStr: string,
  fieldName: string,
): string | null {
  if (!dateStr || !expiryDateStr) return null;
  if (isAfterExpiry(dateStr, expiryDateStr)) {
    return `${fieldName} must be before the expiry date`;
  }
  return null;
}

/**
 * Validates that a sequence of named dates is in non-decreasing order.
 * Returns a map of field name → error message for any violations.
 */
export function validateDateOrdering(
  orderedDates: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const entries = Object.entries(orderedDates).filter(([, v]) => v);

  for (let i = 1; i < entries.length; i++) {
    const [prevKey, prevVal] = entries[i - 1];
    const [currKey, currVal] = entries[i];

    if (parseDateUTC(currVal) < parseDateUTC(prevVal)) {
      errors[currKey] = `${currKey} must be on or after ${prevKey}`;
    }
  }

  return errors;
}
