import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SmsTemplateType {
  EMERGENCY = 'EMERGENCY',
  REMINDER = 'REMINDER',
  ALERT = 'ALERT',
}

@Entity('sms_templates')
export class SmsTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  name: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: SmsTemplateType,
  })
  @Index()
  type: SmsTemplateType;

  @Column('simple-json', { nullable: true })
  variables: string[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
