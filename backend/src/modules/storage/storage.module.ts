import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { GCSStorageProvider } from './providers/gcs-storage.provider';
import { storageConfig } from '../../config/storage.config';

/**
 * Storage Module
 *
 * Global module providing storage capabilities across the application.
 * Supports AWS S3 and Google Cloud Storage with automatic provider switching.
 *
 * @example
 * // Inject StorageService in any service
 * constructor(private readonly storage: StorageService) {}
 *
 * // Upload a file
 * const result = await this.storage.upload({
 *   key: 'users/123/profile.jpg',
 *   body: buffer,
 *   contentType: 'image/jpeg',
 * });
 */
@Global()
@Module({
  imports: [ConfigModule.forFeature(storageConfig)],
  providers: [StorageService, S3StorageProvider, GCSStorageProvider],
  exports: [StorageService],
})
export class StorageModule {}
