// @ts-nocheck
import { Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bullmq';
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
export class FileBackupProcessor {
  private readonly logger = new Logger(FileBackupProcessor.name);

  constructor(
    @InjectRepository(FileBackup)
    private readonly backupRepository: Repository<FileBackup>,
    private readonly storageService: StorageService,
    private readonly fileBackupService: FileBackupService,
  ) {}

  /**
   * Process backup job
   * Downloads file from storage, creates backup copy, updates metadata
   */
  @Process('backup-file')
  async processBackup(job: Job<BackupJobData>): Promise<void> {
    const { backupId, fileId, storageKey, backupStorageKey } = job.data;

    try {
      this.logger.log(`Starting backup job: ${backupId}`);

      // Download file from storage
      const fileData = await this.storageService.download({
        key: storageKey,
      });

      // Calculate checksum
      const checksum = this.calculateChecksum(fileData.buffer);

      // Upload to backup location
      const uploadResult = await this.storageService.upload({
        key: backupStorageKey,
        body: fileData.buffer,
        contentType: fileData.metadata?.contentType || 'application/octet-stream',
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
        fileData.buffer.length,
      );

      this.logger.log(`Backup completed: ${backupId}, size: ${fileData.buffer.length} bytes`);
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
  @Process('restore-backup')
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
          body: backupData.buffer,
          contentType: fileMetadata.file.mimeType,
          metadata: {
            restored: true,
            restoredAt: new Date().toISOString(),
            restoredFrom: backupId,
          },
        });

        this.logger.log(
          `Restore completed: replaced original file ${fileId}`,
        );
      } else {
        // Create new version in a versioned location
        const versionedKey = this.generateVersionedKey(
          backupStorageKey,
          'restored',
        );

        await this.storageService.upload({
          key: versionedKey,
          body: backupData.buffer,
          contentType: backupData.metadata?.contentType || 'application/octet-stream',
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
  @Process('delete-backup')
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
