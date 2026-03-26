import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

export enum NotificationCategory {
    APPOINTMENT = 'APPOINTMENT',
    MEDICATION = 'MEDICATION',
    CONSULTATION = 'CONSULTATION',
    ALERT = 'ALERT',
    MESSAGE = 'MESSAGE',
    VACCINATION = 'VACCINATION',
    LOST_PET = 'LOST_PET',
    MEDICAL_RECORD = 'MEDICAL_RECORD',
    SYSTEM = 'SYSTEM',
}

@Entity('notifications')
@Index(['userId', 'isRead'])
@Index(['userId', 'category'])
@Index(['userId', 'createdAt'])
export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar' })
    userId: string;

    @Column({ type: 'varchar' })
    title: string;

    @Column({ type: 'text' })
    message: string;

    @Column({ type: 'enum', enum: NotificationCategory })
    category: NotificationCategory;

    @Column({ type: 'boolean', default: false })
    isRead: boolean;

    @Column({ type: 'timestamp', nullable: true })
    readAt: Date | null;

    /** Optional deep-link or action URL */
    @Column({ type: 'varchar', nullable: true })
    actionUrl: string | null;

    /** Any extra data (petId, appointmentId, etc.) */
    @Column({ type: 'jsonb', nullable: true })
    metadata: Record<string, unknown> | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
