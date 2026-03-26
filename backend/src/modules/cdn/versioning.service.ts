import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { FileMetadata } from '../upload/entities/file-metadata.entity';
import { FileVersion } from '../upload/entities/file-version.entity';
import { FileVariant } from '../upload/entities/file-variant.entity';
import { StorageService } from '../storage/storage.service';
import { CdnConfig } from '../../config/cdn.config';

/**
 * Create version options
 */
export interface CreateVersionOptions {
  fileId: string;
  buffer: Buffer;
  mimeType: string;
  changeDescription?: string;
  changedBy?: string;
}

/**
 * Version list result
 */
export interface VersionListResult {
  versions: FileVersion[];
  total: number;
  currentVersion: number;
}

/**
 * Versioning Service
 *
 * Manages file version control including:
 * - Creating new versions
 * - Retrieving version history
 * - Restoring previous versions
 * - Cleaning up old versions
 */
@Injectable()
export class VersioningService {
  private readonly logger = new Logger(VersioningService.name);
  private readonly config: CdnConfig['versioning'];

  constructor(
    @InjectRepository(FileMetadata)
    private readonly fileMetadataRepository: Repository<FileMetadata>,
    @InjectRepository(FileVersion)
    private readonly fileVersionRepository: Repository<FileVersion>,
    @InjectRepository(FileVariant)
    private readonly fileVariantRepository: Repository<FileVariant>,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    this.config = this.configService.get<CdnConfig['versioning']>(
      'cdn.versioning',
    ) || {
      enabled: true,
      maxVersions: 10,
      retainDays: 30,
    };
  }

  /**
   * Create a new version of a file
   */
  async createVersion(options: CreateVersionOptions): Promise<FileVersion> {
    if (!this.config.enabled) {
      throw new Error('File versioning is disabled');
    }

    const fileMetadata = await this.fileMetadataRepository.findOne({
      where: { id: options.fileId },
    });

    if (!fileMetadata) {
      throw new NotFoundException(`File not found: ${options.fileId}`);
    }

    this.logger.log(
      `Creating new version for file ${options.fileId} (current: v${fileMetadata.version})`,
    );

    // Download current version before overwriting
    const currentFile = await this.storageService.download({
      key: fileMetadata.storageKey,
    });

    // Save current version to version storage
    const versionKey = this.generateVersionKey(
      fileMetadata.storageKey,
      fileMetadata.version,
    );

    await this.storageService.upload({
      key: versionKey,
      body: currentFile.body,
      contentType: fileMetadata.mimeType,
      metadata: {
        version: fileMetadata.version.toString(),
        originalKey: fileMetadata.storageKey,
      },
    });

    // Create version record for the old version
    const previousVersion = this.fileVersionRepository.create({
      fileId: options.fileId,
      versionNumber: fileMetadata.version,
      storageKey: versionKey,
      sizeBytes: currentFile.body.length,
      checksum: fileMetadata.checksum,
      changeDescription: 'Previous version archived',
      changedBy: options.changedBy,
    });

    await this.fileVersionRepository.save(previousVersion);

    // Upload new version to original key
    await this.storageService.upload({
      key: fileMetadata.storageKey,
      body: options.buffer,
      contentType: options.mimeType,
    });

    // Update file metadata
    fileMetadata.version += 1;
    fileMetadata.sizeBytes = options.buffer.length;
    fileMetadata.mimeType = options.mimeType;
    fileMetadata.checksum = this.calculateChecksum(options.buffer);
    await this.fileMetadataRepository.save(fileMetadata);

    // Create version record for new version
    const newVersion = this.fileVersionRepository.create({
      fileId: options.fileId,
      versionNumber: fileMetadata.version,
      storageKey: fileMetadata.storageKey,
      sizeBytes: options.buffer.length,
      checksum: fileMetadata.checksum,
      changeDescription: options.changeDescription || 'New version uploaded',
      changedBy: options.changedBy,
      isCurrent: true,
    });

    await this.fileVersionRepository.save(newVersion);

    // Mark previous versions as not current
    await this.fileVersionRepository.update(
      {
        fileId: options.fileId,
        id: previousVersion.id, // Exclude new version
      },
      { isCurrent: false },
    );

    // Cleanup old versions if exceeding max
    await this.cleanupOldVersions(options.fileId);

    this.logger.log(
      `Created version ${fileMetadata.version} for file ${options.fileId}`,
    );

    return newVersion;
  }

  /**
   * Get version history for a file
   */
  async getVersionHistory(
    fileId: string,
    limit = 10,
    offset = 0,
  ): Promise<VersionListResult> {
    const [versions, total] = await this.fileVersionRepository.findAndCount({
      where: { fileId },
      order: { versionNumber: 'DESC' },
      take: limit,
      skip: offset,
    });

    const fileMetadata = await this.fileMetadataRepository.findOne({
      where: { id: fileId },
    });

    return {
      versions,
      total,
      currentVersion: fileMetadata?.version || 0,
    };
  }

  /**
   * Get specific version
   */
  async getVersion(
    fileId: string,
    versionNumber: number,
  ): Promise<FileVersion> {
    const version = await this.fileVersionRepository.findOne({
      where: { fileId, versionNumber },
    });

    if (!version) {
      throw new NotFoundException(
        `Version ${versionNumber} not found for file ${fileId}`,
      );
    }

    return version;
  }

  /**
   * Restore a previous version
   */
  async restoreVersion(
    fileId: string,
    versionNumber: number,
    restoredBy?: string,
  ): Promise<FileVersion> {
    const versionToRestore = await this.getVersion(fileId, versionNumber);

    // Download the version to restore
    const versionFile = await this.storageService.download({
      key: versionToRestore.storageKey,
    });

    // Create new version with restored content
    const newVersion = await this.createVersion({
      fileId,
      buffer: versionFile.body,
      mimeType: versionFile.contentType || 'application/octet-stream',
      changeDescription: `Restored from version ${versionNumber}`,
      changedBy: restoredBy,
    });

    this.logger.log(
      `Restored version ${versionNumber} as version ${newVersion.versionNumber} for file ${fileId}`,
    );

    return newVersion;
  }

  /**
   * Delete a specific version
   */
  async deleteVersion(fileId: string, versionNumber: number): Promise<void> {
    const version = await this.getVersion(fileId, versionNumber);

    if (version.isCurrent) {
      throw new Error('Cannot delete the current version');
    }

    // Delete from storage
    await this.storageService.delete({ key: version.storageKey });

    // Delete version record
    await this.fileVersionRepository.remove(version);

    this.logger.log(`Deleted version ${versionNumber} for file ${fileId}`);
  }

  /**
   * Cleanup old versions exceeding limit
   */
  async cleanupOldVersions(fileId: string): Promise<number> {
    const allVersions = await this.fileVersionRepository.find({
      where: { fileId },
      order: { versionNumber: 'DESC' },
    });

    if (allVersions.length <= this.config.maxVersions) {
      return 0;
    }

    const versionsToDelete = allVersions.slice(this.config.maxVersions);
    let deletedCount = 0;

    for (const version of versionsToDelete) {
      if (!version.isCurrent) {
        try {
          await this.storageService.delete({ key: version.storageKey });
          await this.fileVersionRepository.remove(version);
          deletedCount++;
        } catch (error) {
          this.logger.warn(
            `Failed to delete version ${version.versionNumber}: ${error}`,
          );
        }
      }
    }

    if (deletedCount > 0) {
      this.logger.log(
        `Cleaned up ${deletedCount} old versions for file ${fileId}`,
      );
    }

    return deletedCount;
  }

  /**
   * Cleanup expired versions across all files
   */
  async cleanupExpiredVersions(): Promise<number> {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - this.config.retainDays);

    const expiredVersions = await this.fileVersionRepository.find({
      where: {
        createdAt: LessThan(expirationDate),
        isCurrent: false,
      },
    });

    let deletedCount = 0;

    for (const version of expiredVersions) {
      try {
        await this.storageService.delete({ key: version.storageKey });
        await this.fileVersionRepository.remove(version);
        deletedCount++;
      } catch (error) {
        this.logger.warn(`Failed to delete expired version: ${error}`);
      }
    }

    if (deletedCount > 0) {
      this.logger.log(`Cleaned up ${deletedCount} expired versions`);
    }

    return deletedCount;
  }

  /**
   * Generate version storage key
   */
  private generateVersionKey(originalKey: string, version: number): string {
    const parts = originalKey.split('/');
    const filename = parts.pop() || 'file';
    parts.push('versions', `v${version}-${filename}`);
    return parts.join('/');
  }

  /**
   * Calculate checksum
   */
  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}
