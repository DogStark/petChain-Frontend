import {
  PaymentFrequency,
  PaymentStatus,
} from '../types/scheduling';

import type {
  PaymentSchedule,
  ScheduledPayment,
  NotificationSettings,
  ScheduleFormData,
  ScheduleValidationResult,
  ScheduleValidationError,
  PaymentCalculation,
  RecurrenceRule,
  CreateScheduleResponse,
  UpdateScheduleResponse,
  GetSchedulesResponse,
  CancelScheduleResponse,
  CalendarEvent
} from '../types/scheduling';

export class SchedulingService {
  private static instance: SchedulingService;
  private schedules: Map<string, PaymentSchedule> = new Map();
  private payments: Map<string, ScheduledPayment> = new Map();

  private constructor() {
    this.initializeFromStorage();
  }

  static getInstance(): SchedulingService {
    if (!SchedulingService.instance) {
      SchedulingService.instance = new SchedulingService();
    }
    return SchedulingService.instance;
  }

  // Initialize schedules from localStorage
  private initializeFromStorage(): void {
    try {
      const storedSchedules = localStorage.getItem('wata-board-schedules');
      const storedPayments = localStorage.getItem('wata-board-payments');
      
      if (storedSchedules) {
        const schedules = JSON.parse(storedSchedules);
        schedules.forEach((schedule: PaymentSchedule) => {
          schedule.startDate = new Date(schedule.startDate);
          schedule.endDate = schedule.endDate ? new Date(schedule.endDate) : undefined;
          schedule.nextPaymentDate = new Date(schedule.nextPaymentDate);
          schedule.createdAt = new Date(schedule.createdAt);
          schedule.updatedAt = new Date(schedule.updatedAt);
          schedule.paymentHistory = schedule.paymentHistory.map(payment => ({
            ...payment,
            scheduledDate: new Date(payment.scheduledDate),
            actualPaymentDate: payment.actualPaymentDate ? new Date(payment.actualPaymentDate) : undefined,
            createdAt: new Date(payment.createdAt)
          }));
          this.schedules.set(schedule.id, schedule);
        });
      }

      if (storedPayments) {
        const payments = JSON.parse(storedPayments);
        payments.forEach((payment: ScheduledPayment) => {
          payment.scheduledDate = new Date(payment.scheduledDate);
          payment.actualPaymentDate = payment.actualPaymentDate ? new Date(payment.actualPaymentDate) : undefined;
          payment.createdAt = new Date(payment.createdAt);
          this.payments.set(payment.id, payment);
        });
      }
    } catch (error) {
      console.error('Failed to load schedules from storage:', error);
    }
  }

  // Save schedules to localStorage
  private saveToStorage(): void {
    try {
      localStorage.setItem('wata-board-schedules', JSON.stringify(Array.from(this.schedules.values())));
      localStorage.setItem('wata-board-payments', JSON.stringify(Array.from(this.payments.values())));
    } catch (error) {
      console.error('Failed to save schedules to storage:', error);
    }
  }

  // Generate unique ID
  private generateId(): string {
    return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Validate schedule data
  validateSchedule(data: ScheduleFormData): ScheduleValidationResult {
    const errors: ScheduleValidationError[] = [];
    const warnings: ScheduleValidationError[] = [];

    // Validate meter ID
    if (!data.meterId.trim()) {
      errors.push({ field: 'meterId', message: 'Meter ID is required' });
    }

    // Validate amount
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      errors.push({ field: 'amount', message: 'Amount must be greater than 0' });
    } else if (amount > 1000000) {
      warnings.push({ field: 'amount', message: 'Amount seems unusually high' });
    }

    // Validate start date
    const startDate = new Date(data.startDate);
    if (isNaN(startDate.getTime()) || startDate <= new Date()) {
      errors.push({ field: 'startDate', message: 'Start date must be in the future' });
    }

    // Validate end date
    if (data.endDate) {
      const endDate = new Date(data.endDate);
      if (isNaN(endDate.getTime()) || endDate <= startDate) {
        errors.push({ field: 'endDate', message: 'End date must be after start date' });
      }
    }

    // Validate max payments
    if (data.maxPayments) {
      const maxPayments = parseInt(data.maxPayments);
      if (isNaN(maxPayments) || maxPayments <= 0) {
        errors.push({ field: 'maxPayments', message: 'Maximum payments must be greater than 0' });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Create new payment schedule
  async createSchedule(userId: string, data: ScheduleFormData): Promise<CreateScheduleResponse> {
    try {
      const validation = this.validateSchedule(data);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.map(e => e.message).join(', ')
        };
      }

      const scheduleId = this.generateId();
      const amount = parseFloat(data.amount);
      const startDate = new Date(data.startDate);
      const endDate = data.endDate ? new Date(data.endDate) : undefined;
      const maxPayments = data.maxPayments ? parseInt(data.maxPayments) : undefined;

      const schedule: PaymentSchedule = {
        id: scheduleId,
        userId,
        meterId: data.meterId.trim(),
        amount,
        frequency: data.frequency,
        startDate,
        endDate,
        nextPaymentDate: this.calculateNextPaymentDate(startDate, data.frequency),
        status: PaymentStatus.SCHEDULED,
        description: data.description?.trim(),
        maxPayments,
        currentPaymentCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        notificationSettings: data.notificationSettings,
        paymentHistory: []
      };

      // Create first scheduled payment
      const firstPayment: ScheduledPayment = {
        id: this.generateId(),
        scheduleId: scheduleId,
        amount,
        scheduledDate: schedule.nextPaymentDate,
        status: PaymentStatus.SCHEDULED,
        retryCount: 0,
        createdAt: new Date()
      };

      schedule.paymentHistory.push(firstPayment);
      this.payments.set(firstPayment.id, firstPayment);
      this.schedules.set(scheduleId, schedule);

      this.saveToStorage();

      return {
        success: true,
        schedule
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create schedule: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Update existing schedule
  async updateSchedule(scheduleId: string, updates: Partial<ScheduleFormData>): Promise<UpdateScheduleResponse> {
    try {
      const schedule = this.schedules.get(scheduleId);
      if (!schedule) {
        return {
          success: false,
          error: 'Schedule not found'
        };
      }

      const validation = this.validateSchedule({
        meterId: updates.meterId || schedule.meterId,
        amount: updates.amount || schedule.amount.toString(),
        frequency: updates.frequency || schedule.frequency,
        startDate: updates.startDate || schedule.startDate.toISOString().split('T')[0],
        endDate: updates.endDate || schedule.endDate?.toISOString().split('T')[0],
        description: updates.description || schedule.description,
        maxPayments: updates.maxPayments?.toString() || schedule.maxPayments?.toString(),
        notificationSettings: updates.notificationSettings || schedule.notificationSettings
      });

      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.map(e => e.message).join(', ')
        };
      }

      // Update schedule properties
      if (updates.meterId) schedule.meterId = updates.meterId.trim();
      if (updates.amount) schedule.amount = parseFloat(updates.amount);
      if (updates.frequency) schedule.frequency = updates.frequency;
      if (updates.startDate) {
        schedule.startDate = new Date(updates.startDate);
        schedule.nextPaymentDate = this.calculateNextPaymentDate(schedule.startDate, schedule.frequency);
      }
      if (updates.endDate !== undefined) {
        schedule.endDate = updates.endDate ? new Date(updates.endDate) : undefined;
      }
      if (updates.description !== undefined) schedule.description = updates.description.trim();
      if (updates.maxPayments !== undefined) {
        schedule.maxPayments = updates.maxPayments ? parseInt(updates.maxPayments) : undefined;
      }
      if (updates.notificationSettings) schedule.notificationSettings = updates.notificationSettings;

      schedule.updatedAt = new Date();

      this.schedules.set(scheduleId, schedule);
      this.saveToStorage();

      return {
        success: true,
        schedule
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update schedule: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Cancel schedule
  async cancelSchedule(scheduleId: string, reason?: string): Promise<CancelScheduleResponse> {
    try {
      const schedule = this.schedules.get(scheduleId);
      if (!schedule) {
        return {
          success: false,
          error: 'Schedule not found'
        };
      }

      // Cancel all pending payments
      const pendingPayments = schedule.paymentHistory.filter(p => 
        p.status === PaymentStatus.SCHEDULED || p.status === PaymentStatus.PENDING
      );

      pendingPayments.forEach(payment => {
        payment.status = PaymentStatus.CANCELLED;
        this.payments.set(payment.id, payment);
      });

      // Update schedule status
      schedule.status = PaymentStatus.CANCELLED;
      schedule.updatedAt = new Date();

      if (reason) {
        schedule.description = `${schedule.description || ''} (Cancelled: ${reason})`;
      }

      this.schedules.set(scheduleId, schedule);
      this.saveToStorage();

      return {
        success: true,
        cancelledPayments: pendingPayments.length
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to cancel schedule: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Get user schedules
  async getUserSchedules(userId: string): Promise<GetSchedulesResponse> {
    try {
      const userSchedules = Array.from(this.schedules.values())
        .filter(schedule => schedule.userId === userId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      const analytics = this.calculateAnalytics(userSchedules);

      return {
        success: true,
        schedules: userSchedules,
        analytics
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get schedules: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Get calendar events for a month
  async getCalendarEvents(userId: string, year: number, month: number): Promise<CalendarEvent[]> {
    try {
      const userSchedules = Array.from(this.schedules.values())
        .filter(schedule => schedule.userId === userId);

      const events: Map<string, CalendarEvent> = new Map();

      userSchedules.forEach(schedule => {
        schedule.paymentHistory.forEach(payment => {
          const paymentDate = new Date(payment.scheduledDate);
          if (paymentDate.getFullYear() === year && paymentDate.getMonth() === month) {
            const dateKey = paymentDate.toDateString();
            
            if (!events.has(dateKey)) {
              events.set(dateKey, {
                date: paymentDate,
                payments: [],
                totalAmount: 0,
                status: 'upcoming'
              });
            }

            const event = events.get(dateKey)!;
            event.payments.push(payment);
            event.totalAmount += payment.amount;

            // Determine status based on payments
            if (payment.status === PaymentStatus.COMPLETED) {
              event.status = 'completed';
            } else if (payment.status === PaymentStatus.FAILED) {
              event.status = 'failed';
            }
          }
        });
      });

      return Array.from(events.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    } catch (error) {
      console.error('Failed to get calendar events:', error);
      return [];
    }
  }

  // Process scheduled payments (called by background process)
  async processScheduledPayments(): Promise<void> {
    const now = new Date();
    const schedulesToProcess = Array.from(this.schedules.values())
      .filter(schedule => 
        schedule.status === PaymentStatus.SCHEDULED &&
        schedule.nextPaymentDate <= now
      );

    for (const schedule of schedulesToProcess) {
      await this.processScheduledPayment(schedule);
    }
  }

  // Process individual scheduled payment
  private async processScheduledPayment(schedule: PaymentSchedule): Promise<void> {
    try {
      const pendingPayment = schedule.paymentHistory.find(p => 
        p.status === PaymentStatus.SCHEDULED && 
        p.scheduledDate <= new Date()
      );

      if (!pendingPayment) return;

      // Update payment status to processing
      pendingPayment.status = PaymentStatus.PROCESSING;
      this.payments.set(pendingPayment.id, pendingPayment);

      // Here you would integrate with the actual payment processing
      // For now, we'll simulate the payment
      const success = await this.simulatePayment();

      if (success) {
        pendingPayment.status = PaymentStatus.COMPLETED;
        pendingPayment.actualPaymentDate = new Date();
        pendingPayment.transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        schedule.currentPaymentCount++;
        
        // Calculate next payment date
        const nextDate = this.calculateNextPaymentDate(schedule.nextPaymentDate, schedule.frequency);
        
        // Check if schedule should continue
        const shouldContinue = this.shouldScheduleNextPayment(schedule, nextDate);
        
        if (shouldContinue) {
          schedule.nextPaymentDate = nextDate;
          
          // Create next payment
          const nextPayment: ScheduledPayment = {
            id: this.generateId(),
            scheduleId: schedule.id,
            amount: schedule.amount,
            scheduledDate: nextDate,
            status: PaymentStatus.SCHEDULED,
            retryCount: 0,
            createdAt: new Date()
          };
          
          schedule.paymentHistory.push(nextPayment);
          this.payments.set(nextPayment.id, nextPayment);
        } else {
          schedule.status = PaymentStatus.COMPLETED;
        }
      } else {
        pendingPayment.status = PaymentStatus.FAILED;
        pendingPayment.retryCount++;
        
        if (pendingPayment.retryCount >= 3) {
          schedule.status = PaymentStatus.FAILED;
        }
      }

      schedule.updatedAt = new Date();
      this.schedules.set(schedule.id, schedule);
      this.saveToStorage();

    } catch (error) {
      console.error('Failed to process scheduled payment:', error);
    }
  }

  // Simulate payment processing
  private async simulatePayment(): Promise<boolean> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Simulate 90% success rate
    return Math.random() > 0.1;
  }

  // Calculate next payment date based on frequency
  private calculateNextPaymentDate(currentDate: Date, frequency: PaymentFrequency): Date {
    const nextDate = new Date(currentDate);

    switch (frequency) {
      case PaymentFrequency.DAILY:
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case PaymentFrequency.WEEKLY:
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case PaymentFrequency.BIWEEKLY:
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case PaymentFrequency.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case PaymentFrequency.QUARTERLY:
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case PaymentFrequency.YEARLY:
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      case PaymentFrequency.ONCE:
        // No next payment for one-time payments
        break;
    }

    return nextDate;
  }

  // Check if next payment should be scheduled
  private shouldScheduleNextPayment(schedule: PaymentSchedule, nextDate: Date): boolean {
    // Check if end date is reached
    if (schedule.endDate && nextDate > schedule.endDate) {
      return false;
    }

    // Check if max payments reached
    if (schedule.maxPayments && schedule.currentPaymentCount >= schedule.maxPayments) {
      return false;
    }

    // Check if frequency is ONCE
    if (schedule.frequency === PaymentFrequency.ONCE) {
      return false;
    }

    return true;
  }

  // Calculate analytics for user schedules
  private calculateAnalytics(schedules: PaymentSchedule[]): any {
    const totalScheduled = schedules.length;
    const activeSchedules = schedules.filter(s => s.status === PaymentStatus.SCHEDULED).length;
    
    const allPayments = schedules.flatMap(s => s.paymentHistory);
    const completedPayments = allPayments.filter(p => p.status === PaymentStatus.COMPLETED);
    const failedPayments = allPayments.filter(p => p.status === PaymentStatus.FAILED);
    
    const totalAmount = completedPayments.reduce((sum, p) => sum + p.amount, 0);
    const averageAmount = completedPayments.length > 0 ? totalAmount / completedPayments.length : 0;

    const nextPayments = schedules
      .filter(s => s.status === PaymentStatus.SCHEDULED)
      .map(s => ({ amount: s.amount, date: s.nextPaymentDate }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const nextPayment = nextPayments[0];

    // Calculate monthly projection
    const monthlyProjection = schedules.reduce((sum, s) => {
      if (s.status === PaymentStatus.SCHEDULED) {
        switch (s.frequency) {
          case PaymentFrequency.MONTHLY:
            return sum + s.amount;
          case PaymentFrequency.BIWEEKLY:
            return sum + (s.amount * 2.17); // ~26 biweekly payments per year
          case PaymentFrequency.WEEKLY:
            return sum + (s.amount * 4.33); // ~52 weeks per year
          case PaymentFrequency.QUARTERLY:
            return sum + (s.amount / 3);
          case PaymentFrequency.YEARLY:
            return sum + (s.amount / 12);
          default:
            return sum;
        }
      }
      return sum;
    }, 0);

    return {
      totalScheduled,
      totalCompleted: completedPayments.length,
      totalFailed: failedPayments.length,
      averageAmount,
      nextPaymentAmount: nextPayment?.amount || 0,
      nextPaymentDate: nextPayment?.date || new Date(),
      activeSchedules,
      monthlyProjection
    };
  }

  // Calculate payment projections
  calculatePaymentProjection(schedule: PaymentSchedule, months: number = 12): PaymentCalculation {
    const payments: ScheduledPayment[] = [];
    let currentDate = new Date(schedule.startDate);
    let paymentCount = 0;
    let totalAmount = 0;

    while (paymentCount < months && this.shouldScheduleNextPayment(schedule, currentDate)) {
      if (schedule.frequency !== PaymentFrequency.ONCE) {
        payments.push({
          id: this.generateId(),
          scheduleId: schedule.id,
          amount: schedule.amount,
          scheduledDate: new Date(currentDate),
          status: PaymentStatus.SCHEDULED,
          retryCount: 0,
          createdAt: new Date()
        });
        
        totalAmount += schedule.amount;
        paymentCount++;
        currentDate = this.calculateNextPaymentDate(currentDate, schedule.frequency);
      } else {
        payments.push({
          id: this.generateId(),
          scheduleId: schedule.id,
          amount: schedule.amount,
          scheduledDate: new Date(currentDate),
          status: PaymentStatus.SCHEDULED,
          retryCount: 0,
          createdAt: new Date()
        });
        
        totalAmount += schedule.amount;
        paymentCount++;
        break;
      }
    }

    return {
      nextPaymentDate: schedule.nextPaymentDate,
      paymentCount,
      remainingPayments: schedule.maxPayments ? Math.max(0, schedule.maxPayments - schedule.currentPaymentCount) : -1,
      totalAmount,
      projection: {
        monthly: this.calculateMonthlyProjection(schedule),
        quarterly: this.calculateQuarterlyProjection(schedule),
        yearly: this.calculateYearlyProjection(schedule)
      }
    };
  }

  private calculateMonthlyProjection(schedule: PaymentSchedule): number {
    switch (schedule.frequency) {
      case PaymentFrequency.MONTHLY: return schedule.amount;
      case PaymentFrequency.BIWEEKLY: return schedule.amount * 2.17;
      case PaymentFrequency.WEEKLY: return schedule.amount * 4.33;
      case PaymentFrequency.QUARTERLY: return schedule.amount / 3;
      case PaymentFrequency.YEARLY: return schedule.amount / 12;
      case PaymentFrequency.DAILY: return schedule.amount * 30;
      case PaymentFrequency.ONCE: return 0;
      default: return 0;
    }
  }

  private calculateQuarterlyProjection(schedule: PaymentSchedule): number {
    return this.calculateMonthlyProjection(schedule) * 3;
  }

  private calculateYearlyProjection(schedule: PaymentSchedule): number {
    return this.calculateMonthlyProjection(schedule) * 12;
  }
}
