import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CdnService } from './cdn.service';
import { VersioningService } from './versioning.service';
import { LifecycleService } from './lifecycle.service';
import { FileMetadata } from '../upload/entities/file-metadata.entity';
import { FileVersion } from '../upload/entities/file-version.entity';
import { FileVariant } from '../upload/entities/file-variant.entity';
import { StorageModule } from '../storage/storage.module';

/**
 * CDN Module
 *
 * Provides CDN integration, file versioning, and lifecycle management.
 *
 * Features:
 * - Signed URL generation (CloudFront/Cloudflare)
 * - Cache invalidation
 * - File versioning with history
 * - Storage lifecycle policies
 * - Automatic cleanup jobs
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([FileMetadata, FileVersion, FileVariant]),
    ConfigModule,
    ScheduleModule.forRoot(),
    StorageModule,
  ],
  providers: [CdnService, VersioningService, LifecycleService],
  exports: [CdnService, VersioningService, LifecycleService],
})
export class CdnModule {}
