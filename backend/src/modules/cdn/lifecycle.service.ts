import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FileMetadata } from '../upload/entities/file-metadata.entity';
import { FileVariant } from '../upload/entities/file-variant.entity';
import { FileStatus } from '../upload/entities/file-status.enum';
import { StorageService } from '../storage/storage.service';
import { CdnConfig } from '../../config/cdn.config';

/**
 * Lifecycle action types
 */
export enum LifecycleAction {
  MOVE_TO_IA = 'MOVE_TO_IA',
  MOVE_TO_ARCHIVE = 'MOVE_TO_ARCHIVE',
  DELETE = 'DELETE',
}

/**
 * Lifecycle job result
 */
export interface LifecycleJobResult {
  action: LifecycleAction;
  filesProcessed: number;
  bytesAffected: number;
  errors: number;
}

/**
 * Lifecycle Service
 *
 * Manages storage lifecycle policies:
 * - Move to infrequent access (IA) storage
 * - Move to archive storage
 * - Delete old files
 * - Cleanup orphaned variants
 */
@Injectable()
export class LifecycleService {
  private readonly logger = new Logger(LifecycleService.name);
  private readonly config: CdnConfig['lifecycle'];

  constructor(
    @InjectRepository(FileMetadata)
    private readonly fileMetadataRepository: Repository<FileMetadata>,
    @InjectRepository(FileVariant)
    private readonly fileVariantRepository: Repository<FileVariant>,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    this.config = this.configService.get<CdnConfig['lifecycle']>(
      'cdn.lifecycle',
    ) || {
      moveToIaAfterDays: 30,
      moveToArchiveAfterDays: 90,
      deleteAfterDays: 0,
      applyToVariants: true,
    };
  }

  /**
   * Run lifecycle job (scheduled)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runLifecycleJob(): Promise<LifecycleJobResult[]> {
    this.logger.log('Starting lifecycle job...');

    const results: LifecycleJobResult[] = [];

    // Move to IA storage
    if (this.config.moveToIaAfterDays > 0) {
      const iaResult = await this.moveToInfrequentAccess();
      results.push(iaResult);
    }

    // Move to archive
    if (this.config.moveToArchiveAfterDays > 0) {
      const archiveResult = await this.moveToArchive();
      results.push(archiveResult);
    }

    // Delete old files
    if (this.config.deleteAfterDays > 0) {
      const deleteResult = await this.deleteOldFiles();
      results.push(deleteResult);
    }

    // Cleanup orphaned variants
    await this.cleanupOrphanedVariants();

    this.logger.log('Lifecycle job completed');

    return results;
  }

  /**
   * Move files to infrequent access storage
   */
  async moveToInfrequentAccess(): Promise<LifecycleJobResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.moveToIaAfterDays);

    // Don't move files already in archive or IA
    const files = await this.fileMetadataRepository.find({
      where: {
        updatedAt: LessThan(cutoffDate),
        status: FileStatus.READY,
      },
    });

    let processed = 0;
    let bytesAffected = 0;
    let errors = 0;

    for (const file of files) {
      try {
        // Check if already in IA by metadata
        if (file.metadata?.storageClass === 'STANDARD_IA') {
          continue;
        }

        // Move to IA storage class
        await this.changeStorageClass(file.storageKey, 'STANDARD_IA');

        // Update metadata
        file.metadata = {
          ...file.metadata,
          storageClass: 'STANDARD_IA',
          movedToIaAt: new Date().toISOString(),
        };
        await this.fileMetadataRepository.save(file);

        // Process variants if enabled
        if (this.config.applyToVariants) {
          const variants = await this.fileVariantRepository.find({
            where: { fileId: file.id },
          });

          for (const variant of variants) {
            await this.changeStorageClass(variant.storageKey, 'STANDARD_IA');
            bytesAffected += variant.sizeBytes;
          }
        }

        bytesAffected += file.sizeBytes;
        processed++;
      } catch (error) {
        this.logger.error(`Failed to move file ${file.id} to IA:`, error);
        errors++;
      }
    }

    this.logger.log(`Moved ${processed} files to infrequent access storage`);

    return {
      action: LifecycleAction.MOVE_TO_IA,
      filesProcessed: processed,
      bytesAffected,
      errors,
    };
  }

  /**
   * Move files to archive storage
   */
  async moveToArchive(): Promise<LifecycleJobResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - this.config.moveToArchiveAfterDays,
    );

    const files = await this.fileMetadataRepository.find({
      where: {
        updatedAt: LessThan(cutoffDate),
        status: FileStatus.READY,
      },
    });

    let processed = 0;
    let bytesAffected = 0;
    let errors = 0;

    for (const file of files) {
      try {
        // Skip if already in archive
        if (file.metadata?.storageClass === 'GLACIER') {
          continue;
        }

        // Move to Glacier/archive storage class
        await this.changeStorageClass(file.storageKey, 'GLACIER');

        // Update metadata
        file.metadata = {
          ...file.metadata,
          storageClass: 'GLACIER',
          archivedAt: new Date().toISOString(),
        };
        await this.fileMetadataRepository.save(file);

        bytesAffected += file.sizeBytes;
        processed++;

        // Note: Variants typically don't need archiving
      } catch (error) {
        this.logger.error(`Failed to archive file ${file.id}:`, error);
        errors++;
      }
    }

    this.logger.log(`Archived ${processed} files`);

    return {
      action: LifecycleAction.MOVE_TO_ARCHIVE,
      filesProcessed: processed,
      bytesAffected,
      errors,
    };
  }

  /**
   * Delete old files
   */
  async deleteOldFiles(): Promise<LifecycleJobResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.deleteAfterDays);

    const files = await this.fileMetadataRepository.find({
      where: {
        updatedAt: LessThan(cutoffDate),
        status: FileStatus.READY,
      },
    });

    let processed = 0;
    let bytesAffected = 0;
    let errors = 0;

    for (const file of files) {
      try {
        // Skip if marked as protected
        if (file.metadata?.protected) {
          continue;
        }

        // Delete variants first
        const variants = await this.fileVariantRepository.find({
          where: { fileId: file.id },
        });

        for (const variant of variants) {
          await this.storageService.delete({ key: variant.storageKey });
          bytesAffected += variant.sizeBytes;
        }
        await this.fileVariantRepository.delete({ fileId: file.id });

        // Delete main file
        await this.storageService.delete({ key: file.storageKey });
        bytesAffected += file.sizeBytes;

        // Update status instead of deleting record (soft delete)
        file.status = FileStatus.DELETED;
        await this.fileMetadataRepository.save(file);

        processed++;
      } catch (error) {
        this.logger.error(`Failed to delete file ${file.id}:`, error);
        errors++;
      }
    }

    this.logger.log(`Deleted ${processed} old files`);

    return {
      action: LifecycleAction.DELETE,
      filesProcessed: processed,
      bytesAffected,
      errors,
    };
  }

  /**
   * Cleanup orphaned variants
   */
  async cleanupOrphanedVariants(): Promise<number> {
    // Find variants with no parent file
    const orphanedVariants = await this.fileVariantRepository
      .createQueryBuilder('variant')
      .leftJoin('file_metadata', 'file', 'file.id = variant.fileId')
      .where('file.id IS NULL')
      .getMany();

    let cleaned = 0;

    for (const variant of orphanedVariants) {
      try {
        await this.storageService.delete({ key: variant.storageKey });
        await this.fileVariantRepository.remove(variant);
        cleaned++;
      } catch (error) {
        this.logger.warn(`Failed to cleanup orphaned variant: ${error}`);
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} orphaned variants`);
    }

    return cleaned;
  }

  /**
   * Change storage class for a file
   */
  private async changeStorageClass(
    key: string,
    storageClass: 'STANDARD' | 'STANDARD_IA' | 'GLACIER',
  ): Promise<void> {
    // This would use the storage provider's copy operation with new storage class
    // For S3, this is a copy-to-self with new StorageClass
    // For GCS, this is updating the storage class

    this.logger.debug(`Changing storage class for ${key} to ${storageClass}`);

    // TODO: Implement per provider
    // For S3:
    // await s3Client.send(new CopyObjectCommand({
    //   Bucket: bucket,
    //   CopySource: `${bucket}/${key}`,
    //   Key: key,
    //   StorageClass: storageClass,
    // }));
  }

  /**
   * Get lifecycle statistics
   */
  async getStatistics(): Promise<{
    totalFiles: number;
    standardStorage: number;
    iaStorage: number;
    archivedFiles: number;
    deletedFiles: number;
  }> {
    const totalFiles = await this.fileMetadataRepository.count();
    const deletedFiles = await this.fileMetadataRepository.count({
      where: { status: FileStatus.DELETED },
    });

    // Count by storage class from metadata
    const standard = await this.fileMetadataRepository
      .createQueryBuilder('file')
      .where(
        "file.metadata->>'storageClass' IS NULL OR file.metadata->>'storageClass' = 'STANDARD'",
      )
      .getCount();

    const ia = await this.fileMetadataRepository
      .createQueryBuilder('file')
      .where("file.metadata->>'storageClass' = 'STANDARD_IA'")
      .getCount();

    const archived = await this.fileMetadataRepository
      .createQueryBuilder('file')
      .where("file.metadata->>'storageClass' = 'GLACIER'")
      .getCount();

    return {
      totalFiles,
      standardStorage: standard,
      iaStorage: ia,
      archivedFiles: archived,
      deletedFiles,
    };
  }
}
