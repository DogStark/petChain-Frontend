import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum GdprRequestType {
  EXPORT = 'EXPORT',
  ERASURE = 'ERASURE',
}

export enum GdprRequestStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('gdpr_requests')
export class GdprRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: GdprRequestType })
  type: GdprRequestType;

  @Column({
    type: 'enum',
    enum: GdprRequestStatus,
    default: GdprRequestStatus.PENDING,
  })
  status: GdprRequestStatus;

  @Column({ type: 'text', nullable: true })
  downloadUrl: string | null;

  @CreateDateColumn()
  requestedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;
}
