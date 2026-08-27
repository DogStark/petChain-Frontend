import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum TemplateChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
}

@Entity('notification_templates')
@Index(['name', 'channel'], { unique: true })
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'enum', enum: TemplateChannel })
  channel: TemplateChannel;

  /** Subject line (email) or title (push). Supports {{variable}} placeholders. */
  @Column({ type: 'varchar' })
  subject: string;

  /** Body text. Supports {{variable}} placeholders. */
  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
