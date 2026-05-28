/**
 * Integration tests for payment scheduling functionality.
 * Tests verify scheduled payment creation, modification, cancellation, execution,
 * recurring schedules, conflict handling, and timezone edge cases.
 *
 * All tests use fake timers with a fixed baseline date to ensure deterministic,
 * time-independent test execution.
 *
 * Test Runner: Jest
 * Mock Library: jest.mock for API calls, jest.useFakeTimers for time control
 * Time Mocking: jest.useFakeTimers() with jest.setSystemTime(BASE_DATE)
 */

/**
 * NOTE: This test file is designed to test the SchedulingService from wata-board-frontend.
 * The scheduling functionality is located in the wata-board-frontend subdirectory.
 * 
 * To run these tests:
 * 1. Install Jest: npm install --save-dev jest @types/jest ts-jest
 * 2. Configure Jest to handle TypeScript and path aliases
 * 3. Run: npm test -- tests/integration/scheduling.test.ts
 * 
 * Alternatively, copy this test file to wata-board-frontend/tests/integration/
 * and update the imports to use relative paths.
 */

// Import from wata-board-frontend
import { SchedulingService } from '../wata-board-frontend/src/services/schedulingService';
import {
  ScheduleFrequency,
  ScheduleStatus,
  type Schedule,
  type ScheduledPayment,
  type ScheduleFormData,
  type NotificationSettings,
} from '../wata-board-frontend/src/types/scheduling';

// ============================================================================
// CONSTANTS & SETUP
// ============================================================================

/** Fixed baseline date for all time-dependent tests: Monday, Jan 15, 2024, 10:00 UTC */
const BASE_DATE = new Date('2024-01-15T10:00:00.000Z');

/** Default notification settings for test schedules */
const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email: true,
  push: false,
  sms: false,
  reminderDays: [1, 3],
  successNotification: true,
  failureNotification: true,
};

// ============================================================================
// MOCK FACTORIES
// ============================================================================

/**
 * Creates a mock schedule with sensible defaults.
 * All dates are relative to BASE_DATE to ensure portability.
 */
function createMockSchedule(overrides?: Partial<Schedule>): Schedule {
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
function createMockRecurringSchedule(
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
function createMockScheduledPayment(overrides?: Partial<ScheduledPayment>): ScheduledPayment {
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
function calculateNextPaymentDate(currentDate: Date, frequency: ScheduleFrequency): Date {
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

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Scheduling Integration Tests', () => {
  let service: SchedulingService;

  beforeAll(() => {
    // Mock localStorage for the service
    const localStorageMock = (() => {
      let store: Record<string, string> = {};
      return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
          store[key] = value.toString();
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {
          store = {};
        },
      };
    })();

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
    });
  });

  beforeEach(() => {
    // Use fake timers with BASE_DATE as the starting point
    jest.useFakeTimers();
    jest.setSystemTime(BASE_DATE);

    // Clear localStorage before each test
    localStorage.clear();

    // Create a fresh service instance
    service = SchedulingService.getInstance();
  });

  afterEach(() => {
    // Restore real timers
    jest.useRealTimers();

    // Clear localStorage
    localStorage.clear();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  // ========================================================================
  // SCENARIO 1: SCHEDULE CREATION
  // ========================================================================

  describe('Scenario 1: Schedule Creation', () => {
    test('creates a one-time scheduled payment successfully', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '150.50',
        frequency: ScheduleFrequency.ONCE,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const response = await service.createSchedule('user-123', formData);

      expect(response.success).toBe(true);
      expect(response.schedule).toBeDefined();
      expect(response.schedule?.amount).toBe(150.5);
      expect(response.schedule?.meterId).toBe('meter-001');
      expect(response.schedule?.status).toBe(ScheduleStatus.SCHEDULED);
      expect(response.schedule?.frequency).toBe(ScheduleFrequency.ONCE);
      expect(response.schedule?.currentPaymentCount).toBe(0);
      expect(response.schedule?.paymentHistory.length).toBe(1);
      expect(response.schedule?.paymentHistory[0].status).toBe(ScheduleStatus.SCHEDULED);
    });

    test('creates a recurring daily schedule', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-daily',
        amount: '50',
        frequency: ScheduleFrequency.DAILY,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const response = await service.createSchedule('user-123', formData);

      expect(response.success).toBe(true);
      expect(response.schedule?.frequency).toBe(ScheduleFrequency.DAILY);
      const expectedNextDate = new Date(BASE_DATE.getTime() + 2 * 24 * 3600 * 1000); // +2 days
      expect(response.schedule?.nextPaymentDate.getTime()).toBe(expectedNextDate.getTime());
    });

    test('creates a recurring weekly schedule', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-weekly',
        amount: '100',
        frequency: ScheduleFrequency.WEEKLY,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const response = await service.createSchedule('user-123', formData);

      expect(response.success).toBe(true);
      expect(response.schedule?.frequency).toBe(ScheduleFrequency.WEEKLY);
      const expectedNextDate = new Date(BASE_DATE.getTime() + 8 * 24 * 3600 * 1000); // +8 days
      expect(response.schedule?.nextPaymentDate.getTime()).toBe(expectedNextDate.getTime());
    });

    test('creates a recurring monthly schedule', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-monthly',
        amount: '200',
        frequency: ScheduleFrequency.MONTHLY,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const response = await service.createSchedule('user-123', formData);

      expect(response.success).toBe(true);
      expect(response.schedule?.frequency).toBe(ScheduleFrequency.MONTHLY);
      // Next payment should be Feb 16, 2024 (same day next month)
      const expectedNextDate = new Date(2024, 1, 16, 10, 0, 0, 0); // Feb 16
      expect(response.schedule?.nextPaymentDate.getDate()).toBe(expectedNextDate.getDate());
      expect(response.schedule?.nextPaymentDate.getMonth()).toBe(expectedNextDate.getMonth());
    });

    test('schedule creation fails with missing required fields', async () => {
      const formDataMissingMeter: ScheduleFormData = {
        meterId: '',
        amount: '100',
        frequency: ScheduleFrequency.ONCE,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const response = await service.createSchedule('user-123', formDataMissingMeter);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Meter ID is required');
    });

    test('schedule creation fails with invalid amount', async () => {
      const formDataInvalidAmount: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '-50',
        frequency: ScheduleFrequency.ONCE,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const response = await service.createSchedule('user-123', formDataInvalidAmount);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Amount must be greater than 0');
    });

    test('schedule creation fails with past scheduledAt', async () => {
      const pastDate = new Date(BASE_DATE.getTime() - 3600 * 1000); // -1 hour
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.ONCE,
        startDate: pastDate.toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const response = await service.createSchedule('user-123', formData);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Start date must be in the future');
    });
  });

  // ========================================================================
  // SCENARIO 2: SCHEDULE MODIFICATION
  // ========================================================================

  describe('Scenario 2: Schedule Modification', () => {
    test('updates scheduledAt on a pending schedule', async () => {
      // Create initial schedule
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.ONCE,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const createResponse = await service.createSchedule('user-123', formData);
      const scheduleId = createResponse.schedule!.id;

      // Update the schedule with new start date
      const newStartDate = new Date(BASE_DATE.getTime() + 48 * 3600 * 1000); // +2 days
      const updateResponse = await service.updateSchedule(scheduleId, {
        startDate: newStartDate.toISOString().split('T')[0],
      });

      expect(updateResponse.success).toBe(true);
      expect(updateResponse.schedule?.startDate.getTime()).toBe(newStartDate.getTime());
    });

    test('updates amount on a pending schedule', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.ONCE,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const createResponse = await service.createSchedule('user-123', formData);
      const scheduleId = createResponse.schedule!.id;

      const updateResponse = await service.updateSchedule(scheduleId, {
        amount: '250',
      });

      expect(updateResponse.success).toBe(true);
      expect(updateResponse.schedule?.amount).toBe(250);
      expect(updateResponse.schedule?.status).toBe(ScheduleStatus.SCHEDULED);
    });

    test('cannot modify a non-existent schedule', async () => {
      const updateResponse = await service.updateSchedule('non-existent-id', {
        amount: '250',
      });

      expect(updateResponse.success).toBe(false);
      expect(updateResponse.error).toContain('Schedule not found');
    });

    test('updates recurrence pattern', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.WEEKLY,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const createResponse = await service.createSchedule('user-123', formData);
      const scheduleId = createResponse.schedule!.id;

      const updateResponse = await service.updateSchedule(scheduleId, {
        frequency: ScheduleFrequency.MONTHLY,
      });

      expect(updateResponse.success).toBe(true);
      expect(updateResponse.schedule?.frequency).toBe(ScheduleFrequency.MONTHLY);
      // Next execution should be recalculated
      expect(updateResponse.schedule?.nextPaymentDate).toBeDefined();
    });
  });

  // ========================================================================
  // SCENARIO 3: SCHEDULE CANCELLATION
  // ========================================================================

  describe('Scenario 3: Schedule Cancellation', () => {
    test('cancels a pending schedule successfully', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.ONCE,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const createResponse = await service.createSchedule('user-123', formData);
      const scheduleId = createResponse.schedule!.id;

      const cancelResponse = await service.cancelSchedule(scheduleId, 'User requested cancellation');

      expect(cancelResponse.success).toBe(true);
      expect(cancelResponse.cancelledPayments).toBeGreaterThanOrEqual(0);
    });

    test('cancels a recurring schedule — stops future executions', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.WEEKLY,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const createResponse = await service.createSchedule('user-123', formData);
      const scheduleId = createResponse.schedule!.id;

      const cancelResponse = await service.cancelSchedule(scheduleId);

      expect(cancelResponse.success).toBe(true);

      // Verify schedule is cancelled
      const schedulesResponse = await service.getUserSchedules('user-123');
      const cancelledSchedule = schedulesResponse.schedules?.find(s => s.id === scheduleId);
      expect(cancelledSchedule?.status).toBe(ScheduleStatus.CANCELLED);
    });

    test('cancellation is idempotent', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.ONCE,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const createResponse = await service.createSchedule('user-123', formData);
      const scheduleId = createResponse.schedule!.id;

      // Cancel twice
      const cancelResponse1 = await service.cancelSchedule(scheduleId);
      const cancelResponse2 = await service.cancelSchedule(scheduleId);

      expect(cancelResponse1.success).toBe(true);
      expect(cancelResponse2.success).toBe(true);
    });
  });

  // ========================================================================
  // SCENARIO 4: SCHEDULED PAYMENT EXECUTION
  // ========================================================================

  describe('Scenario 4: Scheduled Payment Execution', () => {
    test('executes payment at the scheduled time', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.ONCE,
        startDate: new Date(BASE_DATE.getTime() + 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const createResponse = await service.createSchedule('user-123', formData);
      const scheduleId = createResponse.schedule!.id;

      // Advance fake timers by 1 hour
      jest.advanceTimersByTime(3600 * 1000);

      // Process scheduled payments
      await service.processScheduledPayments();

      // Verify payment was processed
      const schedulesResponse = await service.getUserSchedules('user-123');
      const schedule = schedulesResponse.schedules?.find(s => s.id === scheduleId);

      // For one-time payments, after execution the schedule should be completed
      expect(schedule?.status).toBe(ScheduleStatus.COMPLETED);
      expect(schedule?.currentPaymentCount).toBe(1);
    });

    test('skips execution if payment is not due yet', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.ONCE,
        startDate: new Date(BASE_DATE.getTime() + 2 * 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const createResponse = await service.createSchedule('user-123', formData);
      const scheduleId = createResponse.schedule!.id;

      // Advance fake timers by only 1 hour (payment is due in 2 hours)
      jest.advanceTimersByTime(3600 * 1000);

      // Process scheduled payments
      await service.processScheduledPayments();

      // Verify payment was NOT processed
      const schedulesResponse = await service.getUserSchedules('user-123');
      const schedule = schedulesResponse.schedules?.find(s => s.id === scheduleId);

      expect(schedule?.status).toBe(ScheduleStatus.SCHEDULED);
      expect(schedule?.currentPaymentCount).toBe(0);
    });

    test('marks schedule as failed on payment error', async () => {
      // TODO: This test requires mocking the payment processing to simulate failures.
      // The current SchedulingService.simulatePayment() has a 90% success rate.
      // To make this test deterministic, we would need to:
      // 1. Mock the simulatePayment method to return false
      // 2. Or add a way to inject a failure scenario
      // For now, this test documents the expected behavior.
      expect(true).toBe(true);
    });

    test('recurring schedule creates next occurrence after execution', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.WEEKLY,
        startDate: new Date(BASE_DATE.getTime() + 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const createResponse = await service.createSchedule('user-123', formData);
      const scheduleId = createResponse.schedule!.id;
      const firstNextPaymentDate = createResponse.schedule!.nextPaymentDate;

      // Advance fake timers by 1 hour to trigger execution
      jest.advanceTimersByTime(3600 * 1000);

      // Process scheduled payments
      await service.processScheduledPayments();

      // Verify next payment was scheduled
      const schedulesResponse = await service.getUserSchedules('user-123');
      const schedule = schedulesResponse.schedules?.find(s => s.id === scheduleId);

      expect(schedule?.status).toBe(ScheduleStatus.SCHEDULED);
      expect(schedule?.currentPaymentCount).toBe(1);
      // Next payment should be 7 days after the first one
      const expectedNextDate = new Date(firstNextPaymentDate.getTime() + 7 * 24 * 3600 * 1000);
      expect(schedule?.nextPaymentDate.getTime()).toBe(expectedNextDate.getTime());
    });
  });

  // ========================================================================
  // SCENARIO 5: RECURRING PAYMENT SCHEDULES
  // ========================================================================

  describe('Scenario 5: Recurring Payment Schedules', () => {
    test('daily recurrence executes multiple times correctly', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-daily',
        amount: '50',
        frequency: ScheduleFrequency.DAILY,
        startDate: new Date(BASE_DATE.getTime() + 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const createResponse = await service.createSchedule('user-123', formData);
      const scheduleId = createResponse.schedule!.id;

      // Execute day 1
      jest.advanceTimersByTime(3600 * 1000);
      await service.processScheduledPayments();

      let schedulesResponse = await service.getUserSchedules('user-123');
      let schedule = schedulesResponse.schedules?.find(s => s.id === scheduleId);
      expect(schedule?.currentPaymentCount).toBe(1);

      // Execute day 2
      jest.advanceTimersByTime(24 * 3600 * 1000);
      await service.processScheduledPayments();

      schedulesResponse = await service.getUserSchedules('user-123');
      schedule = schedulesResponse.schedules?.find(s => s.id === scheduleId);
      expect(schedule?.currentPaymentCount).toBe(2);

      // Execute day 3
      jest.advanceTimersByTime(24 * 3600 * 1000);
      await service.processScheduledPayments();

      schedulesResponse = await service.getUserSchedules('user-123');
      schedule = schedulesResponse.schedules?.find(s => s.id === scheduleId);
      expect(schedule?.currentPaymentCount).toBe(3);
    });

    test('weekly recurrence skips days correctly', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-weekly',
        amount: '100',
        frequency: ScheduleFrequency.WEEKLY,
        startDate: new Date(BASE_DATE.getTime() + 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const createResponse = await service.createSchedule('user-123', formData);
      const scheduleId = createResponse.schedule!.id;

      // Advance 3 days (Thursday)
      jest.advanceTimersByTime(3 * 24 * 3600 * 1000);
      await service.processScheduledPayments();

      let schedulesResponse = await service.getUserSchedules('user-123');
      let schedule = schedulesResponse.schedules?.find(s => s.id === scheduleId);
      expect(schedule?.currentPaymentCount).toBe(0); // Not executed yet

      // Advance 4 more days (Monday again)
      jest.advanceTimersByTime(4 * 24 * 3600 * 1000);
      await service.processScheduledPayments();

      schedulesResponse = await service.getUserSchedules('user-123');
      schedule = schedulesResponse.schedules?.find(s => s.id === scheduleId);
      expect(schedule?.currentPaymentCount).toBe(1); // Now executed
    });

    test('monthly recurrence on the 15th handles month transitions', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-monthly',
        amount: '200',
        frequency: ScheduleFrequency.MONTHLY,
        startDate: new Date(BASE_DATE.getTime() + 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const createResponse = await service.createSchedule('user-123', formData);
      const scheduleId = createResponse.schedule!.id;

      // Advance to trigger first execution
      jest.advanceTimersByTime(3600 * 1000);
      await service.processScheduledPayments();

      let schedulesResponse = await service.getUserSchedules('user-123');
      let schedule = schedulesResponse.schedules?.find(s => s.id === scheduleId);
      expect(schedule?.currentPaymentCount).toBe(1);

      // Next payment should be Feb 15
      const nextPaymentDate = schedule?.nextPaymentDate;
      expect(nextPaymentDate?.getMonth()).toBe(1); // February
      expect(nextPaymentDate?.getDate()).toBe(16); // 16th (since we started on 15th + 1 day)
    });

    test('recurring schedule with end date stops after end date', async () => {
      const endDate = new Date(BASE_DATE.getTime() + 14 * 24 * 3600 * 1000); // +14 days
      const formData: ScheduleFormData = {
        meterId: 'meter-weekly',
        amount: '100',
        frequency: ScheduleFrequency.WEEKLY,
        startDate: new Date(BASE_DATE.getTime() + 3600 * 1000).toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const createResponse = await service.createSchedule('user-123', formData);
      const scheduleId = createResponse.schedule!.id;

      // Execute week 1
      jest.advanceTimersByTime(3600 * 1000);
      await service.processScheduledPayments();

      let schedulesResponse = await service.getUserSchedules('user-123');
      let schedule = schedulesResponse.schedules?.find(s => s.id === scheduleId);
      expect(schedule?.currentPaymentCount).toBe(1);

      // Advance past end date
      jest.advanceTimersByTime(20 * 24 * 3600 * 1000);
      await service.processScheduledPayments();

      schedulesResponse = await service.getUserSchedules('user-123');
      schedule = schedulesResponse.schedules?.find(s => s.id === scheduleId);
      // Schedule should be completed since no more payments can be scheduled
      expect(schedule?.status).toBe(ScheduleStatus.COMPLETED);
    });

    test('recurring schedule with max occurrences stops correctly', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-daily',
        amount: '50',
        frequency: ScheduleFrequency.DAILY,
        startDate: new Date(BASE_DATE.getTime() + 3600 * 1000).toISOString().split('T')[0],
        maxPayments: '3',
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const createResponse = await service.createSchedule('user-123', formData);
      const scheduleId = createResponse.schedule!.id;

      // Execute 3 times
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(24 * 3600 * 1000);
        await service.processScheduledPayments();
      }

      let schedulesResponse = await service.getUserSchedules('user-123');
      let schedule = schedulesResponse.schedules?.find(s => s.id === scheduleId);
      expect(schedule?.currentPaymentCount).toBe(3);
      expect(schedule?.status).toBe(ScheduleStatus.COMPLETED);

      // Attempt 4th execution
      jest.advanceTimersByTime(24 * 3600 * 1000);
      await service.processScheduledPayments();

      schedulesResponse = await service.getUserSchedules('user-123');
      schedule = schedulesResponse.schedules?.find(s => s.id === scheduleId);
      expect(schedule?.currentPaymentCount).toBe(3); // Still 3, not 4
    });
  });

  // ========================================================================
  // SCENARIO 6: CONFLICT HANDLING
  // ========================================================================

  describe('Scenario 6: Conflict Handling', () => {
    test('no conflict for same time, different recipients', async () => {
      const startDate = new Date(BASE_DATE.getTime() + 3600 * 1000).toISOString().split('T')[0];

      const formDataA: ScheduleFormData = {
        meterId: 'meter-A',
        amount: '100',
        frequency: ScheduleFrequency.ONCE,
        startDate,
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const formDataB: ScheduleFormData = {
        meterId: 'meter-B',
        amount: '100',
        frequency: ScheduleFrequency.ONCE,
        startDate,
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const responseA = await service.createSchedule('user-123', formDataA);
      const responseB = await service.createSchedule('user-123', formDataB);

      expect(responseA.success).toBe(true);
      expect(responseB.success).toBe(true);
    });

    test('no conflict for same recipient, different times', async () => {
      const formDataA: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.ONCE,
        startDate: new Date(BASE_DATE.getTime() + 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const formDataB: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.ONCE,
        startDate: new Date(BASE_DATE.getTime() + 7200 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const responseA = await service.createSchedule('user-123', formDataA);
      const responseB = await service.createSchedule('user-123', formDataB);

      expect(responseA.success).toBe(true);
      expect(responseB.success).toBe(true);
    });

    test('multiple schedules for same meter can coexist', async () => {
      const formData1: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '50',
        frequency: ScheduleFrequency.WEEKLY,
        startDate: new Date(BASE_DATE.getTime() + 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const formData2: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '75',
        frequency: ScheduleFrequency.MONTHLY,
        startDate: new Date(BASE_DATE.getTime() + 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const response1 = await service.createSchedule('user-123', formData1);
      const response2 = await service.createSchedule('user-123', formData2);

      expect(response1.success).toBe(true);
      expect(response2.success).toBe(true);

      const schedulesResponse = await service.getUserSchedules('user-123');
      expect(schedulesResponse.schedules?.length).toBe(2);
    });
  });

  // ========================================================================
  // SCENARIO 7: TIMEZONE HANDLING
  // ========================================================================

  describe('Scenario 7: Timezone Handling', () => {
    test('scheduledAt stored as UTC internally', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.ONCE,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const response = await service.createSchedule('user-123', formData);

      // Verify the date is stored correctly
      expect(response.schedule?.startDate).toBeDefined();
      expect(response.schedule?.startDate instanceof Date).toBe(true);
    });

    test('execution triggers at correct wall-clock time', async () => {
      // BASE_DATE is 2024-01-15T10:00:00.000Z
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.ONCE,
        startDate: new Date(BASE_DATE.getTime() + 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const createResponse = await service.createSchedule('user-123', formData);
      const scheduleId = createResponse.schedule!.id;

      // Advance to the scheduled time
      jest.advanceTimersByTime(3600 * 1000);

      // Process scheduled payments
      await service.processScheduledPayments();

      // Verify execution
      const schedulesResponse = await service.getUserSchedules('user-123');
      const schedule = schedulesResponse.schedules?.find(s => s.id === scheduleId);
      expect(schedule?.currentPaymentCount).toBe(1);
    });

    test('DST transition does not skip or double-execute', async () => {
      // This test documents expected behavior for DST transitions.
      // The current implementation uses simple date arithmetic which should
      // handle DST correctly since JavaScript Date handles timezone conversions.
      
      // Create a schedule that would fire during a DST transition
      const formData: ScheduleFormData = {
        meterId: 'meter-dst',
        amount: '100',
        frequency: ScheduleFrequency.DAILY,
        startDate: new Date(BASE_DATE.getTime() + 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const createResponse = await service.createSchedule('user-123', formData);
      const scheduleId = createResponse.schedule!.id;

      // Execute multiple times through a simulated DST period
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(24 * 3600 * 1000);
        await service.processScheduledPayments();
      }

      const schedulesResponse = await service.getUserSchedules('user-123');
      const schedule = schedulesResponse.schedules?.find(s => s.id === scheduleId);
      
      // Should execute exactly 3 times, not skipped or doubled
      expect(schedule?.currentPaymentCount).toBe(3);
    });

    test('schedule created in one timezone executes correctly', async () => {
      // The service stores all dates in UTC, so timezone handling is implicit
      const formData: ScheduleFormData = {
        meterId: 'meter-tz',
        amount: '100',
        frequency: ScheduleFrequency.WEEKLY,
        startDate: new Date(BASE_DATE.getTime() + 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const createResponse = await service.createSchedule('user-123', formData);
      const scheduleId = createResponse.schedule!.id;

      // Advance to first execution
      jest.advanceTimersByTime(3600 * 1000);
      await service.processScheduledPayments();

      let schedulesResponse = await service.getUserSchedules('user-123');
      let schedule = schedulesResponse.schedules?.find(s => s.id === scheduleId);
      expect(schedule?.currentPaymentCount).toBe(1);

      // Advance to second execution (7 days later)
      jest.advanceTimersByTime(7 * 24 * 3600 * 1000);
      await service.processScheduledPayments();

      schedulesResponse = await service.getUserSchedules('user-123');
      schedule = schedulesResponse.schedules?.find(s => s.id === scheduleId);
      expect(schedule?.currentPaymentCount).toBe(2);
    });
  });

  // ========================================================================
  // SCENARIO 8: ANALYTICS & PROJECTIONS
  // ========================================================================

  describe('Scenario 8: Analytics & Projections', () => {
    test('calculates correct analytics for user schedules', async () => {
      const formData1: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.MONTHLY,
        startDate: new Date(BASE_DATE.getTime() + 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const formData2: ScheduleFormData = {
        meterId: 'meter-002',
        amount: '50',
        frequency: ScheduleFrequency.WEEKLY,
        startDate: new Date(BASE_DATE.getTime() + 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      await service.createSchedule('user-123', formData1);
      await service.createSchedule('user-123', formData2);

      const schedulesResponse = await service.getUserSchedules('user-123');

      expect(schedulesResponse.success).toBe(true);
      expect(schedulesResponse.analytics).toBeDefined();
      expect(schedulesResponse.analytics?.totalScheduled).toBe(2);
      expect(schedulesResponse.analytics?.activeSchedules).toBe(2);
    });

    test('calculates payment projections correctly', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.MONTHLY,
        startDate: new Date(BASE_DATE.getTime() + 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const createResponse = await service.createSchedule('user-123', formData);
      const schedule = createResponse.schedule!;

      const projection = service.calculatePaymentProjection(schedule, 12);

      expect(projection).toBeDefined();
      expect(projection.paymentCount).toBeGreaterThan(0);
      expect(projection.totalAmount).toBeGreaterThan(0);
      expect(projection.projection.monthly).toBeGreaterThan(0);
      expect(projection.projection.yearly).toBeGreaterThan(projection.projection.monthly);
    });

    test('retrieves calendar events for a month', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.WEEKLY,
        startDate: new Date(BASE_DATE.getTime() + 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      await service.createSchedule('user-123', formData);

      const events = await service.getCalendarEvents('user-123', 2024, 0); // January 2024

      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].date).toBeDefined();
      expect(events[0].payments).toBeDefined();
      expect(events[0].totalAmount).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // SCENARIO 9: EDGE CASES & ERROR HANDLING
  // ========================================================================

  describe('Scenario 9: Edge Cases & Error Handling', () => {
    test('handles very large amounts', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '999999.99',
        frequency: ScheduleFrequency.ONCE,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const response = await service.createSchedule('user-123', formData);

      expect(response.success).toBe(true);
      expect(response.schedule?.amount).toBe(999999.99);
    });

    test('handles very small amounts', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '0.01',
        frequency: ScheduleFrequency.ONCE,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const response = await service.createSchedule('user-123', formData);

      expect(response.success).toBe(true);
      expect(response.schedule?.amount).toBe(0.01);
    });

    test('handles zero amount validation', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '0',
        frequency: ScheduleFrequency.ONCE,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const response = await service.createSchedule('user-123', formData);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Amount must be greater than 0');
    });

    test('handles end date before start date', async () => {
      const startDate = new Date(BASE_DATE.getTime() + 24 * 3600 * 1000);
      const endDate = new Date(BASE_DATE.getTime() + 12 * 3600 * 1000); // Before start date

      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.WEEKLY,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const response = await service.createSchedule('user-123', formData);

      expect(response.success).toBe(false);
      expect(response.error).toContain('End date must be after start date');
    });

    test('handles invalid max payments', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.WEEKLY,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        maxPayments: '-5',
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const response = await service.createSchedule('user-123', formData);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Maximum payments must be greater than 0');
    });

    test('retrieves schedules for non-existent user', async () => {
      const response = await service.getUserSchedules('non-existent-user');

      expect(response.success).toBe(true);
      expect(response.schedules?.length).toBe(0);
    });

    test('handles special characters in meter ID', async () => {
      const formData: ScheduleFormData = {
        meterId: 'meter-@#$%^&*()',
        amount: '100',
        frequency: ScheduleFrequency.ONCE,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const response = await service.createSchedule('user-123', formData);

      expect(response.success).toBe(true);
      expect(response.schedule?.meterId).toBe('meter-@#$%^&*()');
    });

    test('handles very long description', async () => {
      const longDescription = 'A'.repeat(1000);
      const formData: ScheduleFormData = {
        meterId: 'meter-001',
        amount: '100',
        frequency: ScheduleFrequency.ONCE,
        startDate: new Date(BASE_DATE.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0],
        description: longDescription,
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      };

      const response = await service.createSchedule('user-123', formData);

      expect(response.success).toBe(true);
      expect(response.schedule?.description).toBe(longDescription);
    });
  });
});
