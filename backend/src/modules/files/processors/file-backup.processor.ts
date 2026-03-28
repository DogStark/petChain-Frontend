import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { FileBackup } from '../entities/file-backup.entity';
import { StorageService } from '../../storage/storage.service';
import { FileBackupService } from '../services/file-backup.service';

interface BackupJobData {
  backupId: string;
  fileId: string;
  storageKey: string;
  backupStorageKey: string;
}

interface RestoreJobData {
  backupId: string;
  fileId: string;
  backupStorageKey: string;
  replaceOriginal: boolean;
}

interface DeleteJobData {
  backupId: string;
  backupStorageKey: string;
}

/**
 * File Backup Processor
 *
 * Handles asynchronous backup, restore, and deletion jobs
 * using BullMQ job queue.
 */
@Processor('file-backup')
export class FileBackupProcessor extends WorkerHost {
  private readonly logger = new Logger(FileBackupProcessor.name);

  constructor(
    @InjectRepository(FileBackup)
    private readonly backupRepository: Repository<FileBackup>,
    private readonly storageService: StorageService,
    private readonly fileBackupService: FileBackupService,
  ) {
    super();
  }

  async process(
    job: Job<BackupJobData | RestoreJobData | DeleteJobData>,
  ): Promise<void> {
    if (job.name === 'backup-file') {
      await this.processBackup(job as Job<BackupJobData>);
      return;
    }
    if (job.name === 'restore-backup') {
      await this.processRestore(job as Job<RestoreJobData>);
      return;
    }
    if (job.name === 'delete-backup') {
      await this.processDelete(job as Job<DeleteJobData>);
      return;
    }

    this.logger.warn(`Unknown file-backup job type: ${job.name}`);
  }

  /**
   * Process backup job
   * Downloads file from storage, creates backup copy, updates metadata
   */
  async processBackup(job: Job<BackupJobData>): Promise<void> {
    const { backupId, fileId, storageKey, backupStorageKey } = job.data;

    try {
      this.logger.log(`Starting backup job: ${backupId}`);

      // Download file from storage
      const fileData = await this.storageService.download({
        key: storageKey,
      });

      // Calculate checksum
      const checksum = this.calculateChecksum(fileData.body);

      // Upload to backup location
      const uploadResult = await this.storageService.upload({
        key: backupStorageKey,
        body: fileData.body,
        contentType:
          fileData.metadata?.contentType || 'application/octet-stream',
        metadata: {
          backupId,
          fileId,
          originalKey: storageKey,
          originalChecksum: checksum,
        },
      });

      // Update backup record with completion details
      await this.fileBackupService.completeBackup(
        backupId,
        checksum,
        fileData.body.length,
      );

      this.logger.log(
        `Backup completed: ${backupId}, size: ${fileData.body.length} bytes`,
      );
    } catch (error) {
      this.logger.error(`Backup failed for ${backupId}:`, error);
      await this.fileBackupService.failBackup(
        backupId,
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error; // Re-throw for retry
    }
  }

  /**
   * Process restore job
   * Downloads backup file, restores to original location or creates new version
   */
  async processRestore(job: Job<RestoreJobData>): Promise<void> {
    const { backupId, fileId, backupStorageKey, replaceOriginal } = job.data;

    try {
      this.logger.log(`Starting restore job: ${backupId}`);

      // Download backup file
      const backupData = await this.storageService.download({
        key: backupStorageKey,
      });

      if (replaceOriginal) {
        // Get original file's storage key
        const fileMetadata = await this.backupRepository
          .createQueryBuilder('backup')
          .innerJoinAndSelect('backup.file', 'file')
          .where('backup.id = :backupId', { backupId })
          .getOne();

        if (!fileMetadata?.file) {
          throw new Error('File metadata not found');
        }

        // Upload to original location (overwrite)
        await this.storageService.upload({
          key: fileMetadata.file.storageKey,
          body: backupData.body,
          contentType: fileMetadata.file.mimeType,
          metadata: {
            restored: 'true',
            restoredAt: new Date().toISOString(),
            restoredFrom: backupId,
          },
        });

        this.logger.log(`Restore completed: replaced original file ${fileId}`);
      } else {
        // Create new version in a versioned location
        const versionedKey = this.generateVersionedKey(
          backupStorageKey,
          'restored',
        );

        await this.storageService.upload({
          key: versionedKey,
          body: backupData.body,
          contentType:
            backupData.metadata?.contentType || 'application/octet-stream',
          metadata: {
            restoredFrom: backupId,
            restoredAt: new Date().toISOString(),
          },
        });

        this.logger.log(
          `Restore completed: created new version of file ${fileId}`,
        );
      }
    } catch (error) {
      this.logger.error(`Restore failed for ${backupId}:`, error);
      throw error; // Re-throw for retry
    }
  }

  /**
   * Process backup deletion job
   * Removes backup file from storage and updates record
   */
  async processDelete(job: Job<DeleteJobData>): Promise<void> {
    const { backupId, backupStorageKey } = job.data;

    try {
      this.logger.log(`Starting backup deletion: ${backupId}`);

      // Delete from storage
      await this.storageService.delete({
        key: backupStorageKey,
      });

      this.logger.log(`Backup deleted: ${backupId}`);
    } catch (error) {
      this.logger.error(`Delete backup failed for ${backupId}:`, error);
      // Don't re-throw for deletion failures - log and continue
    }
  }

  /**
   * Calculate SHA256 checksum of file contents
   */
  private calculateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Generate versioned storage key
   */
  private generateVersionedKey(baseKey: string, suffix: string): string {
    const timestamp = Date.now();
    return `${baseKey}.${suffix}.${timestamp}`;
  }
}
