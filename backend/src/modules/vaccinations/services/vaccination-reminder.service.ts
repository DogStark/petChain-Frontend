import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Vaccination } from '../entities/vaccination.entity';

/**
 * Service for managing vaccination reminders
 * Handles scheduling and sending vaccination reminder notifications
 */
@Injectable()
export class VaccinationReminderService {
  private readonly logger = new Logger(VaccinationReminderService.name);

  constructor(
    @InjectRepository(Vaccination)
    private readonly vaccinationRepository: Repository<Vaccination>,
  ) {}

  /**
   * Get vaccinations that need reminders (due within specified days)
   */
  async getVaccinationsNeedingReminders(
    daysUntilDue: number = 7,
  ): Promise<Vaccination[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + daysUntilDue);

    return await this.vaccinationRepository.find({
      where: {
        nextDueDate: MoreThanOrEqual(today) && LessThanOrEqual(futureDate),
        reminderSent: false,
      },
      relations: ['pet', 'vetClinic'],
      order: { nextDueDate: 'ASC' },
    });
  }

  /**
   * Get overdue vaccinations that need immediate attention
   */
  async getOverdueVaccinations(): Promise<Vaccination[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await this.vaccinationRepository.find({
      where: {
        nextDueDate: LessThanOrEqual(today),
      },
      relations: ['pet', 'vetClinic'],
      order: { nextDueDate: 'ASC' },
    });
  }

  /**
   * Process reminders for a pet
   */
  async processRemindersForPet(petId: string): Promise<Vaccination[]> {
    const vaccinations = await this.vaccinationRepository.find({
      where: { petId },
      relations: ['pet', 'vetClinic'],
      order: { nextDueDate: 'ASC' },
    });

    const reminders: Vaccination[] = [];

    for (const vaccination of vaccinations) {
      if (vaccination.nextDueDate && !vaccination.reminderSent) {
        const now = new Date();
        const daysUntilDue = Math.floor(
          (new Date(vaccination.nextDueDate).getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        // Send reminder if within 30 days of due date
        if (daysUntilDue <= 30 && daysUntilDue >= 0) {
          reminders.push(vaccination);
        }
      }
    }

    return reminders;
  }

  /**
   * Create reminder message for a vaccination
   */
  createReminderMessage(vaccination: Vaccination): {
    title: string;
    message: string;
    urgency: 'low' | 'medium' | 'high';
  } {
    const daysUntilDue = Math.floor(
      (new Date(vaccination.nextDueDate).getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24),
    );

    let urgency: 'low' | 'medium' | 'high' = 'low';
    if (daysUntilDue <= 3) {
      urgency = 'high';
    } else if (daysUntilDue <= 10) {
      urgency = 'medium';
    }

    return {
      title: `Vaccination Reminder for ${vaccination.pet?.name || 'Your Pet'}`,
      message: `${vaccination.vaccineName} vaccination is due on ${this.formatDate(
        vaccination.nextDueDate,
      )}. Please schedule an appointment with your veterinarian.`,
      urgency,
    };
  }

  /**
   * Send reminder (to be integrated with notification service)
   * This is a placeholder that should be extended with actual notification delivery
   */
  async sendReminder(
    vaccination: Vaccination,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const reminderMessage = this.createReminderMessage(vaccination);

      this.logger.log(
        `Sending reminder for ${vaccination.pet?.name}: ${reminderMessage.message}`,
      );

      // TODO: Integrate with NotificationService to send:
      // - Email notification
      // - SMS notification (if enabled)
      // - Push notification (if enabled)
      // - In-app notification

      // Mark reminder as sent
      vaccination.reminderSent = true;
      await this.vaccinationRepository.save(vaccination);

      return {
        success: true,
        message: 'Reminder sent successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to send reminder for vaccination ${vaccination.id}:`,
        error,
      );
      return {
        success: false,
        message: 'Failed to send reminder',
      };
    }
  }

  /**
   * Send reminders for multiple vaccinations
   */
  async sendBatchReminders(
    vaccinations: Vaccination[],
    userId: string,
  ): Promise<{
    sent: number;
    failed: number;
    details: Array<{ vaccinationId: string; success: boolean }>;
  }> {
    let sent = 0;
    let failed = 0;
    const details: Array<{ vaccinationId: string; success: boolean }> = [];

    for (const vaccination of vaccinations) {
      const result = await this.sendReminder(vaccination, userId);
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
      details.push({
        vaccinationId: vaccination.id,
        success: result.success,
      });
    }

    this.logger.log(
      `Batch reminder sending complete: ${sent} sent, ${failed} failed`,
    );

    return {
      sent,
      failed,
      details,
    };
  }

  /**
   * Calculate days until vaccination is due
   */
  calculateDaysUntilDue(vaccination: Vaccination): number | null {
    if (!vaccination.nextDueDate) {
      return null;
    }

    const now = new Date();
    const dueDate = new Date(vaccination.nextDueDate);
    const daysUntilDue = Math.floor(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    return daysUntilDue;
  }

  /**
   * Check if vaccination is overdue
   */
  isOverdue(vaccination: Vaccination): boolean {
    if (!vaccination.nextDueDate) {
      return false;
    }

    const daysUntilDue = this.calculateDaysUntilDue(vaccination);
    return daysUntilDue !== null && daysUntilDue < 0;
  }

  /**
   * Get reminder status for a vaccination
   */
  getReminderStatus(vaccination: Vaccination): {
    status: 'overdue' | 'urgent' | 'upcoming' | 'current';
    daysUntilDue: number | null;
    message: string;
  } {
    const daysUntilDue = this.calculateDaysUntilDue(vaccination);

    if (daysUntilDue === null) {
      return {
        status: 'current',
        daysUntilDue: null,
        message: 'No next due date set',
      };
    }

    if (daysUntilDue < 0) {
      return {
        status: 'overdue',
        daysUntilDue,
        message: `Overdue by ${Math.abs(daysUntilDue)} days`,
      };
    }

    if (daysUntilDue <= 3) {
      return {
        status: 'urgent',
        daysUntilDue,
        message: `Due in ${daysUntilDue} days - schedule immediately`,
      };
    }

    if (daysUntilDue <= 30) {
      return {
        status: 'upcoming',
        daysUntilDue,
        message: `Due in ${daysUntilDue} days`,
      };
    }

    return {
      status: 'current',
      daysUntilDue,
      message: `Due in ${daysUntilDue} days`,
    };
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
  }
}
