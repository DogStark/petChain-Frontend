import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

export enum EmailStatus {
    PENDING = 'pending',
    QUEUED = 'queued',
    SENT = 'sent',
    DELIVERED = 'delivered',
    FAILED = 'failed',
    BOUNCED = 'bounced',
    UNSUBSCRIBED = 'unsubscribed',
}

export enum EmailType {
    VERIFICATION = 'verification',
    PASSWORD_RESET = 'password_reset',
    VACCINATION_REMINDER = 'vaccination_reminder',
    APPOINTMENT_CONFIRMATION = 'appointment_confirmation',
    MEDICAL_RECORD_UPDATE = 'medical_record_update',
    LOST_PET_ALERT = 'lost_pet_alert',
    SYSTEM_NOTIFICATION = 'system_notification',
}

@Entity('email_logs')
@Index(['status', 'scheduledAt']) // for queue processing
@Index(['recipientEmail'])
export class EmailLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar' })
    recipientEmail: string;

    @Column({ type: 'varchar', nullable: true })
    recipientUserId: string | null;

    @Column({ type: 'enum', enum: EmailType })
    type: EmailType;

    @Column({ type: 'varchar' })
    subject: string;

    @Column({ type: 'text' })
    htmlBody: string;

    @Column({ type: 'text', nullable: true })
    textBody: string | null;

    @Column({ type: 'enum', enum: EmailStatus, default: EmailStatus.PENDING })
    status: EmailStatus;

    @Column({ type: 'int', default: 0 })
    attemptCount: number;

    @Column({ type: 'int', default: 3 })
    maxAttempts: number;

    @Column({ type: 'timestamp', nullable: true })
    scheduledAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    sentAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    deliveredAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    nextRetryAt: Date | null;

    /** SendGrid message ID for webhook tracking */
    @Column({ type: 'varchar', nullable: true })
    providerMessageId: string | null;

    @Column({ type: 'text', nullable: true })
    errorMessage: string | null;

    /** JSON metadata (petId, appointmentId, etc.) */
    @Column({ type: 'jsonb', nullable: true })
    metadata: Record<string, unknown> | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
