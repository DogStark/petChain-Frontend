import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { FileMetadata } from '../../upload/entities/file-metadata.entity';

/**
 * Processing job status
 */
export enum ProcessingJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Processing job type
 */
export enum ProcessingJobType {
  IMAGE_THUMBNAIL = 'image_thumbnail',
  IMAGE_COMPRESS = 'image_compress',
  IMAGE_WEBP = 'image_webp',
  IMAGE_WATERMARK = 'image_watermark',
  VIDEO_THUMBNAIL = 'video_thumbnail',
  VIDEO_PREVIEW = 'video_preview',
  VIDEO_TRANSCODE = 'video_transcode',
  STRIP_METADATA = 'strip_metadata',
}

/**
 * Processing Job Entity
 *
 * Tracks media processing jobs for async processing with BullMQ.
 */
@Entity('processing_jobs')
@Index(['status'])
@Index(['fileId'])
@Index(['createdAt'])
export class ProcessingJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  fileId: string;

  @ManyToOne(() => FileMetadata, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fileId' })
  file: FileMetadata;

  @Column({
    type: 'enum',
    enum: ProcessingJobType,
  })
  type: ProcessingJobType;

  @Column({
    type: 'enum',
    enum: ProcessingJobStatus,
    default: ProcessingJobStatus.PENDING,
  })
  status: ProcessingJobStatus;

  @Column({ type: 'jsonb', nullable: true })
  options: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  result: {
    variantKey?: string;
    width?: number;
    height?: number;
    size?: number;
    format?: string;
    duration?: number;
  };

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ default: 0 })
  attempts: number;

  @Column({ default: 3 })
  maxAttempts: number;

  @Column({ type: 'int', nullable: true })
  progress: number;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
