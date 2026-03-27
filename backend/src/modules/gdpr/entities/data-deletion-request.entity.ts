import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum DeletionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('data_deletion_requests')
export class DataDeletionRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    type: 'enum',
    enum: DeletionStatus,
    default: DeletionStatus.PENDING,
  })
  status: DeletionStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'deleted_entities' })
  deletedEntities: Record<string, number> | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
