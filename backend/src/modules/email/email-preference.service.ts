import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailPreference } from './entities/email-preference.entity';
import { EmailUnsubscribe } from './entities/email-unsubscribe.entity';
import { EmailType } from './entities/email-log.entity';

export interface UpdatePreferencesDto {
    globalOptIn?: boolean;
    vaccinationReminders?: boolean;
    appointmentConfirmations?: boolean;
    medicalRecordUpdates?: boolean;
    lostPetAlerts?: boolean;
    systemNotifications?: boolean;
}

@Injectable()
export class EmailPreferenceService {
    private readonly logger = new Logger(EmailPreferenceService.name);

    constructor(
        @InjectRepository(EmailPreference)
        private readonly preferenceRepo: Repository<EmailPreference>,
        @InjectRepository(EmailUnsubscribe)
        private readonly unsubscribeRepo: Repository<EmailUnsubscribe>,
    ) { }

    /**
     * Get preferences for a user, creating defaults if none exist yet.
     */
    async getPreferences(userId: string): Promise<EmailPreference> {
        let pref = await this.preferenceRepo.findOne({ where: { userId } });

        if (!pref) {
            pref = this.preferenceRepo.create({ userId });
            await this.preferenceRepo.save(pref);
        }

        return pref;
    }

    /**
     * Update preferences for a user.
     */
    async updatePreferences(
        userId: string,
        dto: UpdatePreferencesDto,
    ): Promise<EmailPreference> {
        let pref = await this.preferenceRepo.findOne({ where: { userId } });

        if (!pref) {
            pref = this.preferenceRepo.create({ userId });
        }

        Object.assign(pref, dto);
        await this.preferenceRepo.save(pref);
        this.logger.log(`Updated email preferences for user ${userId}`);
        return pref;
    }

    /**
     * Process an unsubscribe token from an email link.
     * - If global=true → sets globalOptIn = false
     * - Otherwise     → disables just that email type
     */
    async processUnsubscribeToken(token: string, global = false): Promise<{ message: string }> {
        const record = await this.unsubscribeRepo.findOne({ where: { token } });

        if (!record) {
            throw new NotFoundException('Invalid or expired unsubscribe token');
        }

        if (record.used && global) {
            return { message: 'Already unsubscribed' };
        }

        // Mark token as used
        record.used = true;
        record.usedAt = new Date();
        await this.unsubscribeRepo.save(record);

        if (record.userId) {
            if (global) {
                await this.updatePreferences(record.userId, { globalOptIn: false });
                this.logger.log(`User ${record.userId} globally unsubscribed`);
                return { message: 'You have been unsubscribed from all emails.' };
            }

            if (record.emailType) {
                const prefKey = this.emailTypeToPrefKey(record.emailType);
                if (prefKey) {
                    await this.updatePreferences(record.userId, { [prefKey]: false });
                    this.logger.log(`User ${record.userId} unsubscribed from ${record.emailType}`);
                    return { message: `You have been unsubscribed from ${record.emailType} emails.` };
                }
            }
        }

        return { message: 'Unsubscribe processed.' };
    }

    /**
     * Re-subscribe a user to all emails (opt back in).
     */
    async resubscribe(userId: string): Promise<EmailPreference> {
        return this.updatePreferences(userId, {
            globalOptIn: true,
            vaccinationReminders: true,
            appointmentConfirmations: true,
            medicalRecordUpdates: true,
            lostPetAlerts: true,
            systemNotifications: true,
        });
    }

    private emailTypeToPrefKey(type: EmailType): keyof UpdatePreferencesDto | null {
        const map: Partial<Record<EmailType, keyof UpdatePreferencesDto>> = {
            [EmailType.VACCINATION_REMINDER]: 'vaccinationReminders',
            [EmailType.APPOINTMENT_CONFIRMATION]: 'appointmentConfirmations',
            [EmailType.MEDICAL_RECORD_UPDATE]: 'medicalRecordUpdates',
            [EmailType.LOST_PET_ALERT]: 'lostPetAlerts',
            [EmailType.SYSTEM_NOTIFICATION]: 'systemNotifications',
        };
        return map[type] ?? null;
    }
}