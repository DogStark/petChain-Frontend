import { apiClient } from './client';

export type QuietHoursTimezonePolicy = 'local' | 'fixed';

export interface QuietHoursConfig {
  enabled: boolean;
  /** Local start time in 24h "HH:mm" format. */
  startTime: string;
  /** Local end time in 24h "HH:mm" format. */
  endTime: string;
  /** IANA timezone the quiet hours were configured in, e.g. "America/New_York". */
  timezone: string;
  /**
   * How reminders should be scheduled when the device timezone changes:
   * - "local": quiet hours follow the user's current local time (travel-friendly).
   * - "fixed": quiet hours stay anchored to the configured timezone.
   */
  timezonePolicy: QuietHoursTimezonePolicy;
}

export interface QuietHoursResponse {
  config: QuietHoursConfig;
  /** Backend-owned decision on whether quiet hours may be applied. */
  allowed: boolean;
  /** Backend-provided reason when quiet hours are not allowed (e.g. consent). */
  reason?: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function isValidTimezone(value: string): boolean {
  if (!value) return false;
  try {
    // Intl throws for unknown IANA zones.
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function validateQuietHours(config: QuietHoursConfig): string[] {
  const errors: string[] = [];
  if (!isValidTime(config.startTime)) {
    errors.push('Start time must be a valid HH:mm value.');
  }
  if (!isValidTime(config.endTime)) {
    errors.push('End time must be a valid HH:mm value.');
  }
  if (config.startTime === config.endTime) {
    errors.push('Start and end times must differ.');
  }
  if (!isValidTimezone(config.timezone)) {
    errors.push('Timezone must be a valid IANA timezone.');
  }
  if (config.timezonePolicy !== 'local' && config.timezonePolicy !== 'fixed') {
    errors.push('Timezone policy must be either "local" or "fixed".');
  }
  return errors;
}

export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Returns true when the device timezone differs from the timezone the quiet
 * hours were configured in, indicating the user may have travelled.
 */
export function hasTimezoneChanged(config: QuietHoursConfig): boolean {
  return config.timezone !== getDeviceTimezone();
}

export async function fetchQuietHours(): Promise<QuietHoursResponse> {
  const { data } = await apiClient.get<QuietHoursResponse>('/notifications/quiet-hours');
  return data;
}

export async function updateQuietHours(
  config: QuietHoursConfig,
): Promise<QuietHoursResponse> {
  const errors = validateQuietHours(config);
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }
  const { data } = await apiClient.put<QuietHoursResponse>(
    '/notifications/quiet-hours',
    config,
  );
  return data;
}
