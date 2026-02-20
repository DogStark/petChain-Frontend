import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

@Entity('notification_settings')
@Index(['userId'], { unique: true })
export class NotificationSetting {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar' })
    userId: string;

    /** Master switch — if false, no in-app notifications are shown */
    @Column({ type: 'boolean', default: true })
    globalEnabled: boolean;

    @Column({ type: 'boolean', default: true })
    appointment: boolean;

    @Column({ type: 'boolean', default: true })
    medication: boolean;

    @Column({ type: 'boolean', default: true })
    consultation: boolean;

    @Column({ type: 'boolean', default: true })
    alert: boolean;

    @Column({ type: 'boolean', default: true })
    message: boolean;

    @Column({ type: 'boolean', default: true })
    vaccination: boolean;

    @Column({ type: 'boolean', default: true })
    lostPet: boolean;

    @Column({ type: 'boolean', default: true })
    medicalRecord: boolean;

    @Column({ type: 'boolean', default: true })
    system: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
