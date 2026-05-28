/**
 * Scheduling types for payment scheduling functionality.
 * Defines TypeScript types for creating, managing, and tracking recurring payment schedules.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Frequency options for a recurring schedule */
export enum ScheduleFrequency {
  ONCE = 'once',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

/** Lifecycle status of a schedule */
export enum ScheduleStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused',
}

/** Notification event types for a schedule */
export enum NotificationType {
  PAYMENT_DUE = 'payment_due',
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_FAILED = 'payment_failed',
  SCHEDULE_CREATED = 'schedule_created',
  SCHEDULE_CANCELLED = 'schedule_cancelled',
}

// ---------------------------------------------------------------------------
// Core interfaces
// ---------------------------------------------------------------------------

/** Notification preferences attached to a schedule */
export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  /** Days before payment to send a reminder (e.g. [1, 3, 7]) */
  reminderDays: number[];
  successNotification: boolean;
  failureNotification: boolean;
}

/** A single scheduled payment execution record */
export interface ScheduledPayment {
  id: string;
  scheduleId: string;
  amount: number;
  scheduledDate: Date;
  actualPaymentDate?: Date;
  status: ScheduleStatus;
  transactionId?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
}

/**
 * Core schedule entity representing a payment schedule.
 * Tracks all metadata required to execute and monitor recurring payments.
 */
export interface Schedule {
  id: string;
  userId: string;
  meterId: string;
  amount: number;
  frequency: ScheduleFrequency;
  startDate: Date;
  endDate?: Date;
  nextPaymentDate: Date;
  status: ScheduleStatus;
  description?: string;
  /** Maximum number of payments before the schedule auto-completes */
  maxPayments?: number;
  currentPaymentCount: number;
  createdAt: Date;
  updatedAt: Date;
  notificationSettings: NotificationSettings;
  paymentHistory: ScheduledPayment[];
}

/**
 * A recurring schedule extends Schedule with recurrence-specific fields.
 * Use this type when the schedule is guaranteed to repeat more than once.
 */
export type RecurringSchedule = Schedule & {
  frequency: Exclude<ScheduleFrequency, ScheduleFrequency.ONCE>;
  /** ISO 8601 recurrence rule string (e.g. "FREQ=MONTHLY;INTERVAL=1") */
  rrule?: string;
};

// ---------------------------------------------------------------------------
// Form & validation types
// ---------------------------------------------------------------------------

/** Raw form data before parsing into a Schedule */
export interface ScheduleFormData {
  meterId: string;
  amount: string;
  frequency: ScheduleFrequency;
  startDate: string;
  endDate?: string;
  description?: string;
  maxPayments?: string;
  notificationSettings: NotificationSettings;
}

/** A single validation error on a schedule form field */
export interface ScheduleValidationError {
  field: string;
  message: string;
}

/** Result of validating schedule form data */
export interface ScheduleValidationResult {
  isValid: boolean;
  errors: ScheduleValidationError[];
  warnings: ScheduleValidationError[];
}

// ---------------------------------------------------------------------------
// Analytics & projection types
// ---------------------------------------------------------------------------

/** Aggregated analytics for a user's schedules */
export interface PaymentAnalytics {
  totalScheduled: number;
  totalCompleted: number;
  totalFailed: number;
  averageAmount: number;
  nextPaymentAmount: number;
  nextPaymentDate: Date;
  activeSchedules: number;
  monthlyProjection: number;
}

/** Payment amount projections derived from a schedule */
export interface PaymentCalculation {
  nextPaymentDate: Date;
  paymentCount: number;
  remainingPayments: number;
  totalAmount: number;
  projection: {
    monthly: number;
    quarterly: number;
    yearly: number;
  };
}

// ---------------------------------------------------------------------------
// Calendar types
// ---------------------------------------------------------------------------

/** A calendar day entry grouping payments by date */
export interface CalendarEvent {
  date: Date;
  payments: ScheduledPayment[];
  totalAmount: number;
  status: 'upcoming' | 'completed' | 'failed';
}

/** Calendar view state */
export interface CalendarView {
  month: Date;
  events: CalendarEvent[];
  selectedDate?: Date;
  viewMode: 'month' | 'week' | 'day';
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

/** Response from creating a new schedule */
export interface CreateScheduleResponse {
  success: boolean;
  schedule?: Schedule;
  error?: string;
}

/** Response from updating an existing schedule */
export interface UpdateScheduleResponse {
  success: boolean;
  schedule?: Schedule;
  error?: string;
}

/** Response from fetching schedules */
export interface GetSchedulesResponse {
  success: boolean;
  schedules?: Schedule[];
  analytics?: PaymentAnalytics;
  error?: string;
}

/** Response from cancelling a schedule */
export interface CancelScheduleResponse {
  success: boolean;
  cancelledPayments?: number;
  refundAmount?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Notification types
// ---------------------------------------------------------------------------

/** Notification payload sent when a schedule event occurs */
export interface PaymentNotification {
  type: NotificationType;
  scheduleId: string;
  paymentId?: string;
  message: string;
  scheduledDate: Date;
  amount: number;
  meterId: string;
  actionUrl?: string;
}

// ---------------------------------------------------------------------------
// Export / template types
// ---------------------------------------------------------------------------

/** A reusable schedule template */
export interface ScheduleTemplate {
  id: string;
  name: string;
  description: string;
  frequency: ScheduleFrequency;
  suggestedAmount?: number;
  commonUseCases: string[];
}

/** Parameters for exporting schedule data */
export interface ScheduleExport {
  format: 'csv' | 'json' | 'pdf';
  dateRange: {
    start: Date;
    end: Date;
  };
  includeHistory: boolean;
  includeAnalytics: boolean;
}

// ---------------------------------------------------------------------------
// Recurrence rule type
// ---------------------------------------------------------------------------

/** Low-level recurrence rule for computing future payment dates */
export interface RecurrenceRule {
  frequency: ScheduleFrequency;
  interval: number;
  count?: number;
  until?: Date;
  byWeekDay?: number[];
  byMonthDay?: number[];
}

// ---------------------------------------------------------------------------
// Legacy aliases (backward compatibility)
// ---------------------------------------------------------------------------

/** @deprecated Use {@link ScheduleFrequency} instead */
export { ScheduleFrequency as PaymentFrequency };

/** @deprecated Use {@link ScheduleStatus} instead */
export { ScheduleStatus as PaymentStatus };

/** @deprecated Use {@link Schedule} instead */
export type PaymentSchedule = Schedule;
