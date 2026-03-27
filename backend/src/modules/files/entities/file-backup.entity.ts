import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { FileMetadata } from '../../upload/entities/file-metadata.entity';

/**
 * Backup Status
 * - PENDING: Queued for backup
 * - COMPLETED: Successfully backed up
 * - FAILED: Backup failed
 * - PURGED: Backup has been deleted
 */
export enum BackupStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PURGED = 'purged',
}

/**
 * File Backup Entity
 * 
 * Tracks file backups for disaster recovery and version management.
 * Maintains point-in-time recovery capability.
 */
@Entity('file_backups')
@Index(['fileId', 'createdAt'])
@Index(['status'])
@Index(['expiresAt'])
export class FileBackup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Original file being backed up
   */
  @Column()
  fileId: string;

  @ManyToOne(() => FileMetadata, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fileId' })
  file: FileMetadata;

  /**
   * Storage location of the backup
   * Points to backup storage using pattern: backups/{fileId}/{timestamp}
   */
  @Column()
  backupStorageKey: string;

  /**
   * Backup status
   */
  @Column({
    type: 'enum',
    enum: BackupStatus,
    default: BackupStatus.PENDING,
  })
  status: BackupStatus;

  /**
   * Size of the backup in bytes
   */
  @Column({ nullable: true, type: 'bigint' })
  sizeBytes: number | null;

  /**
   * Checksum/hash of the backup for integrity verification
   */
  @Column({ nullable: true })
  checksum: string | null;

  /**
   * Cloud provider transaction/job ID
   * For reference and recovery purposes
   */
  @Column({ nullable: true })
  cloudTransactionId: string | null;

  /**
   * When this backup was created/scheduled
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * When the backup was completed
   */
  @Column({ nullable: true })
  completedAt: Date | null;

  /**
   * Retention period - when this backup can be deleted
   * Default: 90 days from creation
   */
  @Column()
  expiresAt: Date;

  /**
   * Error message if backup failed
   */
  @Column({ nullable: true, length: 1000 })
  errorDetails: string | null;

  /**
   * Backup type/reason
   * - AUTO: Scheduled backup
   * - MANUAL: User-initiated backup
   * - RETENTION: Archive for compliance
   */
  @Column({
    type: 'varchar',
    default: 'AUTO',
  })
  backupType: 'AUTO' | 'MANUAL' | 'RETENTION';

  /**
   * Metadata about the file at backup time
   * Stores file info for recovery reference
   */
  @Column({ type: 'jsonb', nullable: true })
  fileMetadataSnapshot: {
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
  } | null;
}
