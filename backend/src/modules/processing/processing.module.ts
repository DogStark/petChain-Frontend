import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ProcessingService } from './processing.service';
import { ImageProcessingService } from './services/image-processing.service';
import { VideoProcessingService } from './services/video-processing.service';
import { ImageProcessor } from './processors/image.processor';
import { VideoProcessor } from './processors/video.processor';
import { ProcessingJob } from './entities/processing-job.entity';
import { FileMetadata } from '../upload/entities/file-metadata.entity';
import { FileVariant } from '../upload/entities/file-variant.entity';
import { StorageModule } from '../storage/storage.module';
import { ProcessingConfig } from '../../config/processing.config';
import { RealtimeModule } from '../realtime/realtime.module';

/**
 * Processing Module
 *
 * Handles media processing with BullMQ queues.
 *
 * Features:
 * - Image processing (Sharp): thumbnails, compression, watermarks, WebP
 * - Video processing (FFmpeg): thumbnails, previews, transcoding
 * - EXIF/metadata stripping
 * - Async job queue with Redis
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ProcessingJob, FileMetadata, FileVariant]),
    ConfigModule,
    StorageModule,

    // BullMQ configuration
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisConfig =
          configService.get<ProcessingConfig['redis']>('processing.redis');
        return {
          connection: {
            host: redisConfig?.host || 'localhost',
            port: redisConfig?.port || 6379,
            password: redisConfig?.password,
          },
        };
      },
    }),

    // Image processing queue
    BullModule.registerQueue({
      name: 'image-processing',
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    }),

    // Video processing queue
    BullModule.registerQueue({
      name: 'video-processing',
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
      },
    }),
    RealtimeModule,
  ],
  providers: [
    ProcessingService,
    ImageProcessingService,
    VideoProcessingService,
    ImageProcessor,
    VideoProcessor,
  ],
  exports: [ProcessingService, ImageProcessingService, VideoProcessingService],
})
export class ProcessingModule {}
