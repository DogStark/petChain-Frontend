import { apiClient } from './client';

export type ReminderStatus = 'scheduled' | 'snoozed' | 'sent' | 'cancelled';

export interface Reminder {
  id: string;
  petId: string;
  title: string;
  message?: string;
  scheduledFor: string;
  status: ReminderStatus;
  snoozedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Bounded snooze intervals offered to the user. Keeping this list fixed and
 * small avoids unbounded/duplicate scheduling and keeps the UI predictable.
 */
export const SNOOZE_OPTIONS = [
  { minutes: 10, label: '10 minutes' },
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 180, label: '3 hours' },
  { minutes: 1440, label: '1 day' },
] as const;

export type SnoozeMinutes = (typeof SNOOZE_OPTIONS)[number]['minutes'];

export const SNOOZE_MINUTES: readonly SnoozeMinutes[] = SNOOZE_OPTIONS.map(
  (option) => option.minutes,
);

export function isSnoozeMinutes(value: number): value is SnoozeMinutes {
  return (SNOOZE_MINUTES as readonly number[]).includes(value);
}

/**
 * Compute the return time for a snooze. Returns null when the interval is not
 * one of the bounded options so callers can reject invalid input early.
 */
export function computeSnoozeReturnTime(
  minutes: number,
  from: Date = new Date(),
): Date | null {
  if (!isSnoozeMinutes(minutes)) {
    return null;
  }
  return new Date(from.getTime() + minutes * 60 * 1000);
}

/**
 * Format the snooze return time in the user's locale.
 */
export function formatSnoozeReturnTime(
  returnTime: Date,
  locale?: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(returnTime);
}

export interface SnoozeReminderInput {
  reminderId: string;
  minutes: number;
}

/**
 * Snooze an existing reminder. The backend owns authorization and consent
 * decisions; the client only sends the bounded interval. Reusing the existing
 * reminder id (rather than creating a new reminder) prevents duplicate jobs
 * when the user snoozes repeatedly.
 */
export async function snoozeReminder({
  reminderId,
  minutes,
}: SnoozeReminderInput): Promise<Reminder> {
  if (!isSnoozeMinutes(minutes)) {
    throw new Error('Invalid snooze interval');
  }

  const response = await apiClient.post<Reminder>(
    `/reminders/${encodeURIComponent(reminderId)}/snooze`,
    { minutes },
  );
  return response.data;
}
