import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FileBackup, BackupStatus } from '../entities/file-backup.entity';
import { FileMetadata } from '../../upload/entities/file-metadata.entity';
import { StorageService } from '../../storage/storage.service';
import {
  FileBackupResponseDto,
  FileBackupListResponseDto,
  BackupStatisticsDto,
} from '../dto/file-backup.dto';

/**
 * File Backup Service
 *
 * Handles file backup creation, recovery, and retention management.
 * Features:
 * - Point-in-time recovery capability
 * - Automatic scheduled backups
 * - Manual backup on demand
 * - Backup retention policies
 * - Disaster recovery
 */
@Injectable()
export class FileBackupService {
  private readonly logger = new Logger(FileBackupService.name);

  constructor(
    @InjectRepository(FileBackup)
    private readonly backupRepository: Repository<FileBackup>,
    @InjectRepository(FileMetadata)
    private readonly fileMetadataRepository: Repository<FileMetadata>,
    private readonly storageService: StorageService,
    @InjectQueue('file-backup')
    private readonly backupQueue: Queue,
  ) {}

  /**
   * Create a backup of a file
   */
  async createBackup(
    fileId: string,
    userId: string,
    backupType: 'AUTO' | 'MANUAL' = 'MANUAL',
  ): Promise<FileBackupResponseDto> {
    const fileMetadata = await this.fileMetadataRepository.findOne({
      where: { id: fileId },
    });

    if (!fileMetadata) {
      throw new NotFoundException(`File not found: ${fileId}`);
    }

    // Verify user owns the file
    if (fileMetadata.ownerId !== userId) {
      throw new ForbiddenException('Only file owner can create backups');
    }

    // Generate backup storage key
    const timestamp = Date.now();
    const backupStorageKey = this.storageService.generateKey({
      prefix: 'backups',
      ownerId: userId,
      filename: `${fileId}/${timestamp}`,
      variant: 'backup',
    });

    // 90 days default retention
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    // Create backup record
    const backup = this.backupRepository.create({
      fileId,
      backupStorageKey,
      status: BackupStatus.PENDING,
      expiresAt,
      backupType,
      fileMetadataSnapshot: {
        originalFilename: fileMetadata.originalFilename,
        mimeType: fileMetadata.mimeType,
        sizeBytes: fileMetadata.sizeBytes,
        createdAt: fileMetadata.createdAt,
      },
    });

    await this.backupRepository.save(backup);

    // Queue backup job
    await this.backupQueue.add(
      'backup-file',
      {
        backupId: backup.id,
        fileId,
        storageKey: fileMetadata.storageKey,
        backupStorageKey,
      },
      {
        priority: backupType === 'MANUAL' ? 10 : 1,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    this.logger.log(`Queued backup for file ${fileId}: ${backup.id}`);

    return this.mapBackupToDto(backup);
  }

  /**
   * Get backup by ID
   */
  async getBackup(backupId: string, userId?: string): Promise<FileBackupResponseDto> {
    const backup = await this.backupRepository.findOne({
      where: { id: backupId },
      relations: ['file'],
    });

    if (!backup) {
      throw new NotFoundException(`Backup not found: ${backupId}`);
    }

    // Verify access if userId provided
    if (userId && backup.file.ownerId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.mapBackupToDto(backup);
  }

  /**
   * Get backups for a file
   */
  async getFileBackups(
    fileId: string,
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<FileBackupListResponseDto> {
    // Verify ownership
    const fileMetadata = await this.fileMetadataRepository.findOne({
      where: { id: fileId },
    });

    if (!fileMetadata) {
      throw new NotFoundException(`File not found: ${fileId}`);
    }

    if (fileMetadata.ownerId !== userId) {
      throw new ForbiddenException('Only file owner can view backups');
    }

    const skip = (page - 1) * pageSize;

    const [backups, total] = await this.backupRepository.findAndCount({
      where: { fileId },
      skip,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });

    return {
      backups: backups.map(b => this.mapBackupToDto(b)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Restore from a backup
   */
  async restoreFromBackup(
    backupId: string,
    userId: string,
    replaceOriginal: boolean = true,
  ): Promise<FileBackupResponseDto> {
    const backup = await this.backupRepository.findOne({
      where: { id: backupId },
      relations: ['file'],
    });

    if (!backup) {
      throw new NotFoundException(`Backup not found: ${backupId}`);
    }

    // Verify ownership
    if (backup.file.ownerId !== userId) {
      throw new ForbiddenException('Only file owner can restore backups');
    }

    if (backup.status !== BackupStatus.COMPLETED) {
      throw new ForbiddenException('Can only restore completed backups');
    }

    // Queue restore job
    await this.backupQueue.add(
      'restore-backup',
      {
        backupId,
        fileId: backup.fileId,
        backupStorageKey: backup.backupStorageKey,
        replaceOriginal,
      },
      {
        priority: 10,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    this.logger.log(`Queued restore from backup ${backupId}`);

    return this.mapBackupToDto(backup);
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string, userId: string): Promise<void> {
    const backup = await this.backupRepository.findOne({
      where: { id: backupId },
      relations: ['file'],
    });

    if (!backup) {
      throw new NotFoundException(`Backup not found: ${backupId}`);
    }

    // Verify ownership
    if (backup.file.ownerId !== userId) {
      throw new ForbiddenException('Only file owner can delete backups');
    }

    // Queue deletion job
    await this.backupQueue.add(
      'delete-backup',
      {
        backupId,
        backupStorageKey: backup.backupStorageKey,
      },
      {
        priority: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    // Update status
    backup.status = BackupStatus.PURGED;
    await this.backupRepository.save(backup);

    this.logger.log(`Marked backup ${backupId} for deletion`);
  }

  /**
   * Scheduled job: Create daily backups for all files
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduleAutoBackups(): Promise<void> {
    this.logger.debug('Starting auto backup job');

    try {
      // Get all files that don't have a backup from today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const filesNeedingBackup = await this.fileMetadataRepository.find({
        where: {
          createdAt: new Date(0), // Placeholder - in real scenario, check based on last backup
        },
      });

      for (const file of filesNeedingBackup) {
        await this.createBackup(file.id, file.ownerId, 'AUTO');
      }

      this.logger.debug(
        `Completed auto backup job for ${filesNeedingBackup.length} files`,
      );
    } catch (error) {
      this.logger.error('Auto backup job failed:', error);
    }
  }

  /**
   * Scheduled job: Clean up expired backups
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupExpiredBackups(): Promise<number> {
    this.logger.debug('Starting backup cleanup job');

    try {
      const expiredBackups = await this.backupRepository.find({
        where: {
          expiresAt: LessThan(new Date()),
          status: BackupStatus.COMPLETED,
        },
      });

      for (const backup of expiredBackups) {
        // Queue deletion
        await this.backupQueue.add('delete-backup', {
          backupId: backup.id,
          backupStorageKey: backup.backupStorageKey,
        });

        backup.status = BackupStatus.PURGED;
        await this.backupRepository.save(backup);
      }

      this.logger.debug(`Cleaned up ${expiredBackups.length} expired backups`);
      return expiredBackups.length;
    } catch (error) {
      this.logger.error('Backup cleanup job failed:', error);
      return 0;
    }
  }

  /**
   * Get backup statistics (for admin dashboard)
   */
  async getBackupStatistics(): Promise<BackupStatisticsDto> {
    const stats = await this.backupRepository
      .createQueryBuilder('backup')
      .select('COUNT(*)', 'totalBackups')
      .addSelect(
        `SUM(CASE WHEN status = '${BackupStatus.COMPLETED}' THEN 1 ELSE 0 END)`,
        'completedBackups',
      )
      .addSelect(
        `SUM(CASE WHEN status = '${BackupStatus.FAILED}' THEN 1 ELSE 0 END)`,
        'failedBackups',
      )
      .addSelect('SUM(sizeBytes)', 'totalBackupSizeBytes')
      .addSelect('AVG(sizeBytes)', 'averageBackupSizeBytes')
      .addSelect('MIN(createdAt)', 'oldestBackup')
      .addSelect('MAX(createdAt)', 'newestBackup')
      .getRawOne();

    return {
      totalBackups: parseInt(stats.totalBackups || '0', 10),
      completedBackups: parseInt(stats.completedBackups || '0', 10),
      failedBackups: parseInt(stats.failedBackups || '0', 10),
      totalBackupSizeBytes: parseInt(stats.totalBackupSizeBytes || '0', 10),
      averageBackupSizeBytes: parseInt(stats.averageBackupSizeBytes || '0', 10),
      oldestBackup: stats.oldestBackup,
      newestBackup: stats.newestBackup,
    };
  }

  /**
   * Update backup status and metadata after completion
   */
  async completeBackup(backupId: string, checksum: string, sizeBytes: number): Promise<void> {
    await this.backupRepository.update(
      { id: backupId },
      {
        status: BackupStatus.COMPLETED,
        completedAt: new Date(),
        checksum,
        sizeBytes,
      },
    );

    this.logger.log(`Backup ${backupId} completed successfully`);
  }

  /**
   * Mark backup as failed
   */
  async failBackup(backupId: string, errorDetails: string): Promise<void> {
    await this.backupRepository.update(
      { id: backupId },
      {
        status: BackupStatus.FAILED,
        errorDetails: errorDetails.substring(0, 1000),
      },
    );

    this.logger.error(`Backup ${backupId} failed: ${errorDetails}`);
  }

  /**
   * Map backup entity to DTO
   */
  private mapBackupToDto(backup: FileBackup): FileBackupResponseDto {
    return {
      id: backup.id,
      fileId: backup.fileId,
      backupStorageKey: backup.backupStorageKey,
      status: backup.status,
      sizeBytes: backup.sizeBytes,
      checksum: backup.checksum,
      createdAt: backup.createdAt,
      completedAt: backup.completedAt,
      expiresAt: backup.expiresAt,
      errorDetails: backup.errorDetails,
      backupType: backup.backupType,
      fileMetadataSnapshot: backup.fileMetadataSnapshot,
    };
  }
}
