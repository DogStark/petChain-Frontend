import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { FileMetadata } from './entities/file-metadata.entity';
import { FileVersion } from './entities/file-version.entity';
import { FileVariant } from './entities/file-variant.entity';
import { StorageModule } from '../storage/storage.module';
import { ValidationModule } from '../validation/validation.module';
import { SecurityModule } from '../security/security.module';

/**
 * Upload Module
 *
 * Handles file upload, storage, and management functionality.
 *
 * Features:
 * - Single file upload with comprehensive validation
 * - MIME type and magic number validation
 * - Virus scanning (ClamAV)
 * - Optional file encryption at rest
 * - File metadata management
 * - Version control
 * - Variant management (thumbnails, compressed, etc.)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([FileMetadata, FileVersion, FileVariant]),
    MulterModule.register({
      storage: memoryStorage(), // Use memory storage for processing
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
    StorageModule,
    ValidationModule,
    SecurityModule,
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
