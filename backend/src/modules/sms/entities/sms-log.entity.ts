import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SmsTemplate } from './sms-template.entity';

export enum SmsStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

@Entity('sms_logs')
export class SmsLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  phoneNumber: string;

  @Column({ nullable: true })
  templateId: string;

  @ManyToOne(() => SmsTemplate, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'templateId' })
  template: SmsTemplate;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'enum',
    enum: SmsStatus,
    default: SmsStatus.PENDING,
  })
  @Index()
  status: SmsStatus;

  @Column({ nullable: true })
  twilioSid: string;

  @Column({ nullable: true })
  errorCode: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  costInCents: string;

  @Column({ default: 1 })
  segments: number;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date;
}
