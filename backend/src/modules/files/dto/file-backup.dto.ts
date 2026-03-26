import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { BackupStatus } from '../entities/file-backup.entity';

/**
 * DTO for initiating manual backup
 */
export class CreateBackupDto {
  /**
   * File ID to backup
   */
  @IsUUID()
  fileId: string;

  /**
   * Optional custom backup notes
   */
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO for backup restore request
 */
export class RestoreFromBackupDto {
  /**
   * Backup ID to restore from
   */
  @IsUUID()
  backupId: string;

  /**
   * Whether to replace the current file (true) or create a new version (false)
   */
  @IsOptional()
  replaceOriginal?: boolean;
}

/**
 * Response DTO for backup
 */
export class FileBackupResponseDto {
  id: string;
  fileId: string;
  backupStorageKey: string;
  status: BackupStatus;
  sizeBytes: number | null;
  checksum: string | null;
  createdAt: Date;
  completedAt: Date | null;
  expiresAt: Date;
  errorDetails: string | null;
  backupType: 'AUTO' | 'MANUAL' | 'RETENTION';
  fileMetadataSnapshot?: {
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
  };
}

/**
 * Response DTO for backup list
 */
export class FileBackupListResponseDto {
  backups: FileBackupResponseDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * DTO for file backup statistics (admin)
 */
export class BackupStatisticsDto {
  totalBackups: number;
  completedBackups: number;
  failedBackups: number;
  totalBackupSizeBytes: number;
  averageBackupSizeBytes: number;
  oldestBackup: Date | null;
  newestBackup: Date | null;
}
