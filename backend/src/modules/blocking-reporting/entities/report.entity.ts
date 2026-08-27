import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ReportTargetType {
  USER = 'USER',
  PET = 'PET',
  RECORD = 'RECORD',
  COMMENT = 'COMMENT',
}

export enum ReportReason {
  SPAM = 'SPAM',
  ABUSE = 'ABUSE',
  MISINFORMATION = 'MISINFORMATION',
  OTHER = 'OTHER',
}

export enum ReportStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

@Entity('reports')
@Index(['reporterId'])
@Index(['targetId', 'targetType'])
@Index(['status'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  reporterId: string;

  @Column({ type: 'uuid' })
  targetId: string;

  @Column({
    type: 'enum',
    enum: ReportTargetType,
  })
  targetType: ReportTargetType;

  @Column({
    type: 'enum',
    enum: ReportReason,
  })
  reason: ReportReason;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  status: ReportStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}