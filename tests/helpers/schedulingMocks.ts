/**
 * Mock factories and test helpers for scheduling integration tests.
 * Provides reusable mock data builders for Schedule, ScheduledPayment, and related types.
 */

import {
  ScheduleFrequency,
  ScheduleStatus,
  type Schedule,
  type ScheduledPayment,
  type NotificationSettings,
} from '../../wata-board-frontend/src/types/scheduling';

/** Fixed baseline date for all time-dependent tests: Monday, Jan 15, 2024, 10:00 UTC */
export const BASE_DATE = new Date('2024-01-15T10:00:00.000Z');

/** Default notification settings for test schedules */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email: true,
  push: false,
  sms: false,
  reminderDays: [1, 3],
  successNotification: true,
  failureNotification: true,
};

/**
 * Creates a mock schedule with sensible defaults.
 * All dates are relative to BASE_DATE to ensure portability.
 */
export function createMockSchedule(overrides?: Partial<Schedule>): Schedule {
  return {
    id: `schedule-${Math.random().toString(36).substr(2, 9)}`,
    userId: 'user-test-123',
    meterId: 'meter-test-456',
    amount: 100,
    frequency: ScheduleFrequency.ONCE,
    startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000), // +1 day
    nextPaymentDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000), // +1 day
    status: ScheduleStatus.SCHEDULED,
    currentPaymentCount: 0,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
    paymentHistory: [],
    ...overrides,
  };
}

/**
 * Creates a mock recurring schedule with a specified frequency.
 */
export function createMockRecurringSchedule(
  frequency: Exclude<ScheduleFrequency, ScheduleFrequency.ONCE>,
  overrides?: Partial<Schedule>
): Schedule {
  const nextPaymentDate = calculateNextPaymentDate(BASE_DATE, frequency);
  return createMockSchedule({
    frequency,
    nextPaymentDate,
    ...overrides,
  });
}

/**
 * Creates a mock scheduled payment record.
 */
export function createMockScheduledPayment(overrides?: Partial<ScheduledPayment>): ScheduledPayment {
  return {
    id: `payment-${Math.random().toString(36).substr(2, 9)}`,
    scheduleId: 'schedule-test-id',
    amount: 100,
    scheduledDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000), // +1 day
    status: ScheduleStatus.SCHEDULED,
    retryCount: 0,
    createdAt: BASE_DATE,
    ...overrides,
  };
}

/**
 * Calculates the next payment date based on frequency.
 * Mirrors the logic in SchedulingService.
 */
export function calculateNextPaymentDate(currentDate: Date, frequency: ScheduleFrequency): Date {
  const nextDate = new Date(currentDate);

  switch (frequency) {
    case ScheduleFrequency.DAILY:
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case ScheduleFrequency.WEEKLY:
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case ScheduleFrequency.BIWEEKLY:
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case ScheduleFrequency.MONTHLY:
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case ScheduleFrequency.QUARTERLY:
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case ScheduleFrequency.YEARLY:
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    case ScheduleFrequency.ONCE:
      // No next payment for one-time payments
      break;
  }

  return nextDate;
}

/**
 * Advances fake timers by a specified number of days.
 * Useful for testing recurring schedules and time-dependent logic.
 */
export function advanceDays(days: number): void {
  jest.advanceTimersByTime(days * 24 * 3600 * 1000);
}

/**
 * Advances fake timers by a specified number of hours.
 */
export function advanceHours(hours: number): void {
  jest.advanceTimersByTime(hours * 3600 * 1000);
}

/**
 * Advances fake timers by a specified number of minutes.
 */
export function advanceMinutes(minutes: number): void {
  jest.advanceTimersByTime(minutes * 60 * 1000);
}

/**
 * Resets the fake timer to BASE_DATE.
 */
export function resetTimerToBase(): void {
  jest.setSystemTime(BASE_DATE);
}
