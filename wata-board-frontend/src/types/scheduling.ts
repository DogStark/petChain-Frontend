export enum PaymentFrequency {
  ONCE = 'once',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly'
}

export enum PaymentStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused'
}

export enum NotificationType {
  PAYMENT_DUE = 'payment_due',
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_FAILED = 'payment_failed',
  SCHEDULE_CREATED = 'schedule_created',
  SCHEDULE_CANCELLED = 'schedule_cancelled'
}

export interface PaymentSchedule {
  id: string;
  userId: string;
  meterId: string;
  amount: number;
  frequency: PaymentFrequency;
  startDate: Date;
  endDate?: Date;
  nextPaymentDate: Date;
  status: PaymentStatus;
  description?: string;
  maxPayments?: number;
  currentPaymentCount: number;
  createdAt: Date;
  updatedAt: Date;
  notificationSettings: NotificationSettings;
  paymentHistory: ScheduledPayment[];
}

export interface ScheduledPayment {
  id: string;
  scheduleId: string;
  amount: number;
  scheduledDate: Date;
  actualPaymentDate?: Date;
  status: PaymentStatus;
  transactionId?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  reminderDays: number[];
  successNotification: boolean;
  failureNotification: boolean;
}

export interface ScheduleFormData {
  meterId: string;
  amount: string;
  frequency: PaymentFrequency;
  startDate: string;
  endDate?: string;
  description?: string;
  maxPayments?: string;
  notificationSettings: NotificationSettings;
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  description: string;
  frequency: PaymentFrequency;
  suggestedAmount?: number;
  commonUseCases: string[];
}

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

export interface CalendarEvent {
  date: Date;
  payments: ScheduledPayment[];
  totalAmount: number;
  status: 'upcoming' | 'completed' | 'failed';
}

// Validation types
export interface ScheduleValidationError {
  field: string;
  message: string;
}

export interface ScheduleValidationResult {
  isValid: boolean;
  errors: ScheduleValidationError[];
  warnings: ScheduleValidationError[];
}

// Helper types for calculations
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

// API Response types
export interface CreateScheduleResponse {
  success: boolean;
  schedule?: PaymentSchedule;
  error?: string;
}

export interface UpdateScheduleResponse {
  success: boolean;
  schedule?: PaymentSchedule;
  error?: string;
}

export interface GetSchedulesResponse {
  success: boolean;
  schedules?: PaymentSchedule[];
  analytics?: PaymentAnalytics;
  error?: string;
}

export interface CancelScheduleResponse {
  success: boolean;
  cancelledPayments?: number;
  refundAmount?: number;
  error?: string;
}

// Calendar view types
export interface CalendarView {
  month: Date;
  events: CalendarEvent[];
  selectedDate?: Date;
  viewMode: 'month' | 'week' | 'day';
}

// Recurrence calculation types
export interface RecurrenceRule {
  frequency: PaymentFrequency;
  interval: number;
  count?: number;
  until?: Date;
  byWeekDay?: number[];
  byMonthDay?: number[];
}

// Notification payload types
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

// Export utility types
export interface ScheduleExport {
  format: 'csv' | 'json' | 'pdf';
  dateRange: {
    start: Date;
    end: Date;
  };
  includeHistory: boolean;
  includeAnalytics: boolean;
}
