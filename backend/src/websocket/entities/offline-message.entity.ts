import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum MessagePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

@Entity('offline_messages')
export class OfflineMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  event: string;

  @Column('jsonb')
  payload: any;

  @Column({
    type: 'enum',
    enum: MessagePriority,
    default: MessagePriority.MEDIUM,
  })
  priority: MessagePriority;

  @Column({ default: false })
  delivered: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
