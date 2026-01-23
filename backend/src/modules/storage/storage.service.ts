import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IStorageProvider,
  STORAGE_PROVIDER,
} from './interfaces/storage-provider.interface';
import {
  UploadOptions,
  UploadResult,
  DownloadOptions,
  DownloadResult,
  SignedUrlOptions,
  DeleteOptions,
  CopyOptions,
  FileMetadata,
  ListOptions,
  ListResult,
} from './interfaces/storage-types.interface';
import { StorageConfig } from '../../config/storage.config';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { GCSStorageProvider } from './providers/gcs-storage.provider';
import { ModuleRef } from '@nestjs/core';

/**
 * Storage Service
 *
 * Unified service that delegates to the configured storage provider.
 * Supports switching between providers via configuration.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private provider: IStorageProvider;
  private readonly logger = new Logger(StorageService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit(): Promise<void> {
    const config = this.configService.get<StorageConfig>('storage');
    if (!config) {
      throw new Error('Storage configuration not found');
    }

    // Select provider based on configuration
    const providerType = config.provider;
    this.logger.log(
      `Initializing storage service with provider: ${providerType}`,
    );

    switch (providerType) {
      case 's3':
        this.provider = this.moduleRef.get(S3StorageProvider, {
          strict: false,
        });
        break;
      case 'gcs':
        this.provider = this.moduleRef.get(GCSStorageProvider, {
          strict: false,
        });
        break;
      default:
        throw new Error(`Unknown storage provider: ${providerType}`);
    }

    this.logger.log(
      `Storage provider initialized: ${this.provider.providerName}`,
    );
  }

  /**
   * Get the current provider name
   */
  get providerName(): string {
    return this.provider?.providerName || 'uninitialized';
  }

  /**
   * Upload a file to storage
   */
  async upload(options: UploadOptions): Promise<UploadResult> {
    this.logger.debug(`Uploading file: ${options.key}`);
    return this.provider.upload(options);
  }

  /**
   * Download a file from storage
   */
  async download(options: DownloadOptions): Promise<DownloadResult> {
    this.logger.debug(`Downloading file: ${options.key}`);
    return this.provider.download(options);
  }

  /**
   * Generate a signed URL for temporary access
   */
  async getSignedUrl(options: SignedUrlOptions): Promise<string> {
    return this.provider.getSignedUrl(options);
  }

  /**
   * Delete a file from storage
   */
  async delete(options: DeleteOptions): Promise<void> {
    this.logger.debug(`Deleting file: ${options.key}`);
    return this.provider.delete(options);
  }

  /**
   * Check if a file exists
   */
  async exists(key: string): Promise<boolean> {
    return this.provider.exists(key);
  }

  /**
   * Get file metadata
   */
  async getMetadata(key: string): Promise<FileMetadata> {
    return this.provider.getMetadata(key);
  }

  /**
   * Copy a file within storage
   */
  async copy(options: CopyOptions): Promise<FileMetadata> {
    this.logger.debug(
      `Copying file: ${options.sourceKey} -> ${options.destinationKey}`,
    );
    return this.provider.copy(options);
  }

  /**
   * List files in storage
   */
  async list(options: ListOptions): Promise<ListResult> {
    return this.provider.list(options);
  }

  /**
   * Get public URL (if available)
   */
  getPublicUrl(key: string): string | null {
    return this.provider.getPublicUrl(key);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.provider.healthCheck();
  }

  /**
   * Generate a unique storage key for a file
   */
  generateKey(options: {
    prefix?: string;
    ownerId?: string;
    petId?: string;
    filename: string;
    variant?: string;
  }): string {
    const parts: string[] = [];

    // Add prefix if provided (e.g., 'uploads', 'processed')
    if (options.prefix) {
      parts.push(options.prefix);
    }

    // Add owner ID for user-specific files
    if (options.ownerId) {
      parts.push(`users/${options.ownerId}`);
    }

    // Add pet ID for pet-specific files
    if (options.petId) {
      parts.push(`pets/${options.petId}`);
    }

    // Add variant subfolder if specified (e.g., 'thumbnails', 'originals')
    if (options.variant) {
      parts.push(options.variant);
    }

    // Add timestamp and original filename
    const timestamp = Date.now();
    const safeFilename = this.sanitizeFilename(options.filename);
    parts.push(`${timestamp}-${safeFilename}`);

    return parts.join('/');
  }

  /**
   * Sanitize filename to prevent path traversal and invalid characters
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace invalid chars with underscore
      .replace(/\.{2,}/g, '.') // Prevent multiple dots
      .replace(/^\.+/, '') // Remove leading dots
      .toLowerCase();
  }
}
