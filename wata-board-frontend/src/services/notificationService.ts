import {
  NotificationType,
} from '../types/scheduling';

import type {
  PaymentNotification,
  NotificationSettings,
  PaymentSchedule,
  ScheduledPayment
} from '../types/scheduling';

export interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

export class NotificationService {
  private static instance: NotificationService;
  private notificationQueue: PaymentNotification[] = [];
  private isProcessing = false;

  private constructor() {
    this.initializeNotificationSystem();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Initialize notification system
  private initializeNotificationSystem(): void {
    // Request notification permissions
    this.requestPermissions();
    
    // Set up periodic processing
    setInterval(() => {
      this.processNotificationQueue();
    }, 5000); // Process every 5 seconds

    // Listen for visibility changes to process notifications when tab is active
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.processNotificationQueue();
      }
    });
  }

  // Request notification permissions
  async requestPermissions(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported in this browser');
      return { granted: false, denied: false, default: true };
    }

    if (Notification.permission === 'granted') {
      return { granted: true, denied: false, default: false };
    }

    if (Notification.permission === 'denied') {
      return { granted: false, denied: true, default: false };
    }

    try {
      const permission = await Notification.requestPermission();
      return {
        granted: permission === 'granted',
        denied: permission === 'denied',
        default: permission === 'default'
      };
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return { granted: false, denied: false, default: true };
    }
  }

  // Check notification permissions
  getPermissionStatus(): NotificationPermission {
    if (!('Notification' in window)) {
      return { granted: false, denied: false, default: true };
    }

    return {
      granted: Notification.permission === 'granted',
      denied: Notification.permission === 'denied',
      default: Notification.permission === 'default'
    };
  }

  // Send notification for scheduled payment
  async sendPaymentNotification(
    type: NotificationType,
    schedule: PaymentSchedule,
    payment?: ScheduledPayment
  ): Promise<void> {
    const notification: PaymentNotification = {
      type,
      scheduleId: schedule.id,
      paymentId: payment?.id,
      message: this.getNotificationMessage(type, schedule, payment),
      scheduledDate: payment?.scheduledDate || schedule.nextPaymentDate,
      amount: payment?.amount || schedule.amount,
      meterId: schedule.meterId,
      actionUrl: `/schedules/${schedule.id}`
    };

    await this.queueNotification(notification);
  }

  // Queue notification for processing
  private async queueNotification(notification: PaymentNotification): Promise<void> {
    this.notificationQueue.push(notification);
    
    // Process immediately if not already processing
    if (!this.isProcessing) {
      await this.processNotificationQueue();
    }
  }

  // Process notification queue
  private async processNotificationQueue(): Promise<void> {
    if (this.isProcessing || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.notificationQueue.length > 0) {
        const notification = this.notificationQueue.shift()!;
        await this.processNotification(notification);
      }
    } catch (error) {
      console.error('Error processing notification queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Process individual notification
  private async processNotification(notification: PaymentNotification): Promise<void> {
    const permission = this.getPermissionStatus();
    
    if (!permission.granted) {
      console.log('Notification permissions not granted, skipping:', notification.type);
      return;
    }

    try {
      // Send browser notification
      await this.sendBrowserNotification(notification);
      
      // Send in-app notification
      this.sendInAppNotification(notification);
      
      // Store notification history
      await this.storeNotificationHistory(notification);
      
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  // Send browser notification
  private async sendBrowserNotification(notification: PaymentNotification): Promise<void> {
    const title = this.getNotificationTitle(notification.type);
    const options: NotificationOptions = {
      body: notification.message,
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      tag: `${notification.type}-${notification.scheduleId}`,
      requireInteraction: notification.type === NotificationType.PAYMENT_FAILED,
      silent: false,
      vibrate: [200, 100, 200],
      data: {
        scheduleId: notification.scheduleId,
        paymentId: notification.paymentId,
        actionUrl: notification.actionUrl
      }
    };

    const browserNotification = new Notification(title, options);

    // Handle notification clicks
    browserNotification.onclick = () => {
      this.handleNotificationClick(notification);
      browserNotification.close();
    };

    // Auto-close after 5 seconds for non-critical notifications
    if (notification.type !== NotificationType.PAYMENT_FAILED) {
      setTimeout(() => {
        browserNotification.close();
      }, 5000);
    }
  }

  // Send in-app notification
  private sendInAppNotification(notification: PaymentNotification): void {
    // Create custom event for in-app notifications
    const event = new CustomEvent('paymentNotification', {
      detail: notification
    });
    
    document.dispatchEvent(event);
    
    // You could also integrate with a toast notification library here
    console.log('In-app notification:', notification);
  }

  // Store notification history
  private async storeNotificationHistory(notification: PaymentNotification): Promise<void> {
    try {
      const history = this.getNotificationHistory();
      history.push({
        ...notification,
        timestamp: new Date(),
        read: false
      });
      
      // Keep only last 100 notifications
      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }
      
      localStorage.setItem('wata-board-notification-history', JSON.stringify(history));
    } catch (error) {
      console.error('Error storing notification history:', error);
    }
  }

  // Get notification history
  getNotificationHistory(): any[] {
    try {
      const stored = localStorage.getItem('wata-board-notification-history');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading notification history:', error);
      return [];
    }
  }

  // Handle notification click
  private handleNotificationClick(notification: PaymentNotification): void {
    // Mark notification as read
    this.markNotificationAsRead(notification);
    
    // Navigate to appropriate page
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  }

  // Mark notification as read
  private markNotificationAsRead(notification: PaymentNotification): void {
    try {
      const history = this.getNotificationHistory();
      const updatedHistory = history.map(item => {
        if (item.scheduleId === notification.scheduleId && 
            item.paymentId === notification.paymentId &&
            item.type === notification.type) {
          return { ...item, read: true };
        }
        return item;
      });
      
      localStorage.setItem('wata-board-notification-history', JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // Get notification title
  private getNotificationTitle(type: NotificationType): string {
    const titles = {
      [NotificationType.PAYMENT_DUE]: 'Payment Due Soon',
      [NotificationType.PAYMENT_SUCCESS]: 'Payment Successful',
      [NotificationType.PAYMENT_FAILED]: 'Payment Failed',
      [NotificationType.SCHEDULE_CREATED]: 'Payment Schedule Created',
      [NotificationType.SCHEDULE_CANCELLED]: 'Payment Schedule Cancelled'
    };
    
    return titles[type] || 'Wata-Board Notification';
  }

  // Get notification message
  private getNotificationMessage(
    type: NotificationType,
    schedule: PaymentSchedule,
    payment?: ScheduledPayment
  ): string {
    const amount = payment?.amount || schedule.amount;
    const meterId = schedule.meterId;
    const description = schedule.description || 'Utility payment';

    switch (type) {
      case NotificationType.PAYMENT_DUE:
        const daysUntil = this.getDaysUntil(payment?.scheduledDate || schedule.nextPaymentDate);
        return `Your ${description} of ${this.formatCurrency(amount)} for ${meterId} is due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}.`;
      
      case NotificationType.PAYMENT_SUCCESS:
        return `Successfully paid ${this.formatCurrency(amount)} for ${meterId}. Transaction: ${payment?.transactionId?.slice(0, 10)}...`;
      
      case NotificationType.PAYMENT_FAILED:
        return `Payment failed for ${meterId}. Amount: ${this.formatCurrency(amount)}. Please check your account and try again.`;
      
      case NotificationType.SCHEDULE_CREATED:
        return `Payment schedule created for ${meterId}. ${this.formatCurrency(amount)} ${this.getFrequencyDescription(schedule.frequency)}.`;
      
      case NotificationType.SCHEDULE_CANCELLED:
        return `Payment schedule cancelled for ${meterId}.`;
      
      default:
        return `Notification for ${meterId}: ${this.formatCurrency(amount)}`;
    }
  }

  // Get days until date
  private getDaysUntil(date: Date): number {
    const now = new Date();
    const targetDate = new Date(date);
    const diffTime = targetDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Format currency
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'XLM',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  // Get frequency description
  private getFrequencyDescription(frequency: string): string {
    const descriptions = {
      'once': 'one-time',
      'daily': 'daily',
      'weekly': 'weekly',
      'biweekly': 'bi-weekly',
      'monthly': 'monthly',
      'quarterly': 'quarterly',
      'yearly': 'yearly'
    };
    
    return (descriptions as any)[frequency] || frequency;
  }

  // Send reminder notifications
  async sendReminderNotifications(schedules: PaymentSchedule[]): Promise<void> {
    for (const schedule of schedules) {
      if (schedule.status !== 'scheduled') continue;
      
      const settings = schedule.notificationSettings;
      if (!settings.email && !settings.push && !settings.sms) continue;
      
      const nextPaymentDate = schedule.nextPaymentDate;
      const daysUntil = this.getDaysUntil(nextPaymentDate);
      
      // Check if we should send a reminder
      if (settings.reminderDays.includes(daysUntil)) {
        await this.sendPaymentNotification(
          NotificationType.PAYMENT_DUE,
          schedule
        );
      }
    }
  }

  // Send payment success notification
  async sendPaymentSuccessNotification(
    schedule: PaymentSchedule,
    payment: ScheduledPayment
  ): Promise<void> {
    if (!schedule.notificationSettings.successNotification) return;
    
    await this.sendPaymentNotification(
      NotificationType.PAYMENT_SUCCESS,
      schedule,
      payment
    );
  }

  // Send payment failure notification
  async sendPaymentFailureNotification(
    schedule: PaymentSchedule,
    payment: ScheduledPayment
  ): Promise<void> {
    if (!schedule.notificationSettings.failureNotification) return;
    
    await this.sendPaymentNotification(
      NotificationType.PAYMENT_FAILED,
      schedule,
      payment
    );
  }

  // Send schedule creation notification
  async sendScheduleCreatedNotification(schedule: PaymentSchedule): Promise<void> {
    await this.sendPaymentNotification(
      NotificationType.SCHEDULE_CREATED,
      schedule
    );
  }

  // Send schedule cancellation notification
  async sendScheduleCancelledNotification(schedule: PaymentSchedule): Promise<void> {
    await this.sendPaymentNotification(
      NotificationType.SCHEDULE_CANCELLED,
      schedule
    );
  }

  // Get unread notification count
  getUnreadNotificationCount(): number {
    try {
      const history = this.getNotificationHistory();
      return history.filter(item => !item.read).length;
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      return 0;
    }
  }

  // Clear notification history
  clearNotificationHistory(): void {
    try {
      localStorage.removeItem('wata-board-notification-history');
    } catch (error) {
      console.error('Error clearing notification history:', error);
    }
  }

  // Test notification system
  async testNotification(): Promise<boolean> {
    try {
      const permission = await this.requestPermissions();
      if (!permission.granted) {
        return false;
      }

      const testNotification = new Notification('Test Notification', {
        body: 'Wata-Board notifications are working!',
        icon: '/icon-192x192.png',
        tag: 'test'
      });

      setTimeout(() => {
        testNotification.close();
      }, 3000);

      return true;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  }
}
