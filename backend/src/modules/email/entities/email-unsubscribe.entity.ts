import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';
import { EmailType } from './email-log.entity';

@Entity('email_unsubscribes')
export class EmailUnsubscribe {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column({ type: 'varchar', unique: true })
    token: string;

    @Column({ type: 'varchar' })
    email: string;

    @Column({ type: 'varchar', nullable: true })
    userId: string | null;

    /**
     * If null → global unsubscribe (all emails).
     * If set → unsubscribe from that specific email type only.
     */
    @Column({ type: 'enum', enum: EmailType, nullable: true })
    emailType: EmailType | null;

    @Column({ type: 'boolean', default: false })
    used: boolean;

    @Column({ type: 'timestamp', nullable: true })
    usedAt: Date | null;

    @CreateDateColumn()
    createdAt: Date;
}
