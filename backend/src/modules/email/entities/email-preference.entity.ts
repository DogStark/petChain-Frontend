import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { EmailType } from './email-log.entity';

@Entity('email_preferences')
@Index(['userId'], { unique: true })
export class EmailPreference {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar' })
    userId: string;

    /** Master switch — if false, no emails are sent regardless of other settings */
    @Column({ type: 'boolean', default: true })
    globalOptIn: boolean;

    @Column({ type: 'boolean', default: true })
    vaccinationReminders: boolean;

    @Column({ type: 'boolean', default: true })
    appointmentConfirmations: boolean;

    @Column({ type: 'boolean', default: true })
    medicalRecordUpdates: boolean;

    @Column({ type: 'boolean', default: true })
    lostPetAlerts: boolean;

    @Column({ type: 'boolean', default: true })
    systemNotifications: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

/** Maps EmailType enum to the preference column name */
export const EMAIL_TYPE_TO_PREFERENCE: Partial<Record<EmailType, keyof EmailPreference>> = {
    [EmailType.VACCINATION_REMINDER]: 'vaccinationReminders',
    [EmailType.APPOINTMENT_CONFIRMATION]: 'appointmentConfirmations',
    [EmailType.MEDICAL_RECORD_UPDATE]: 'medicalRecordUpdates',
    [EmailType.LOST_PET_ALERT]: 'lostPetAlerts',
    [EmailType.SYSTEM_NOTIFICATION]: 'systemNotifications',
};
