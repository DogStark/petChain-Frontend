import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImageProcessingService } from '../services/image-processing.service';
import { StorageService } from '../../storage/storage.service';
import { FileMetadata } from '../../upload/entities/file-metadata.entity';
import { FileVariant } from '../../upload/entities/file-variant.entity';
import {
  ProcessingJob,
  ProcessingJobStatus,
  ProcessingJobType,
} from '../entities/processing-job.entity';
import { VariantType } from '../../upload/entities/variant-type.enum';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

/**
 * Image processing job data
 */
export interface ImageJobData {
  fileId: string;
  processingJobId: string;
  jobType: ProcessingJobType;
  options?: {
    width?: number;
    height?: number;
    quality?: number;
    addWatermark?: boolean;
  };
}

@Processor('image-processing')
export class ImageProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageProcessor.name);

  constructor(
    private readonly imageProcessingService: ImageProcessingService,
    private readonly storageService: StorageService,
    @InjectRepository(FileMetadata)
    private readonly fileMetadataRepository: Repository<FileMetadata>,
    @InjectRepository(FileVariant)
    private readonly fileVariantRepository: Repository<FileVariant>,
    @InjectRepository(ProcessingJob)
    private readonly processingJobRepository: Repository<ProcessingJob>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {
    super();
  }

  // ... process method ...

  private async updateJobStatus(
    jobId: string,
    status: ProcessingJobStatus,
    result?: Record<string, unknown>,
    errorMessage?: string,
  ): Promise<void> {
    const updateData: Partial<ProcessingJob> = { status };

    if (status === ProcessingJobStatus.PROCESSING) {
      updateData.startedAt = new Date();
    }

    if (
      status === ProcessingJobStatus.COMPLETED ||
      status === ProcessingJobStatus.FAILED
    ) {
      updateData.completedAt = new Date();
    }

    if (result) {
      updateData.result = result as ProcessingJob['result'];
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    await this.processingJobRepository.update(
      jobId,
      updateData as Record<string, unknown>,
    );
  }

  async process(job: Job<ImageJobData>): Promise<void> {
    const { fileId, processingJobId, jobType, options } = job.data;

    this.logger.log(`Processing image job: ${jobType} for file ${fileId}`);

    // Update job status
    await this.updateJobStatus(processingJobId, ProcessingJobStatus.PROCESSING);

    // Emit realtime status
    this.realtimeGateway.emitProcessingStatus({
      fileId,
      status: ProcessingJobStatus.PROCESSING,
      progress: 0,
    });

    try {
      // Get file metadata
      const fileMetadata = await this.fileMetadataRepository.findOne({
        where: { id: fileId },
      });

      if (!fileMetadata) {
        throw new Error(`File not found: ${fileId}`);
      }

      // Download original file
      const originalFile = await this.storageService.download({
        key: fileMetadata.storageKey,
      });

      let result: {
        buffer: Buffer;
        width: number;
        height: number;
        format: string;
        size: number;
      };
      let variantType: VariantType;
      let suffix: string;

      // Process based on job type
      switch (jobType) {
        case ProcessingJobType.IMAGE_THUMBNAIL:
          result = await this.imageProcessingService.generateThumbnail(
            originalFile.body,
            options?.width,
            options?.height,
          );
          variantType = VariantType.THUMBNAIL;
          suffix = 'thumb';
          break;

        case ProcessingJobType.IMAGE_COMPRESS:
          result = await this.imageProcessingService.compress(
            originalFile.body,
            options?.quality,
          );
          variantType = VariantType.COMPRESSED;
          suffix = 'compressed';
          break;

        case ProcessingJobType.IMAGE_WEBP:
          result = await this.imageProcessingService.convertToWebP(
            originalFile.body,
            options?.quality,
          );
          variantType = VariantType.WEBP;
          suffix = 'webp';
          break;

        case ProcessingJobType.IMAGE_WATERMARK:
          result = await this.imageProcessingService.addWatermark(
            originalFile.body,
          );
          variantType = VariantType.WATERMARKED;
          suffix = 'watermarked';
          break;

        case ProcessingJobType.STRIP_METADATA:
          result = await this.imageProcessingService.stripMetadata(
            originalFile.body,
          );
          // Update original file in place
          await this.storageService.upload({
            key: fileMetadata.storageKey,
            body: result.buffer,
            contentType: fileMetadata.mimeType,
          });
          await this.updateJobStatus(
            processingJobId,
            ProcessingJobStatus.COMPLETED,
            {
              width: result.width,
              height: result.height,
              size: result.size,
              format: result.format,
            },
          );
          return;

        default:
          throw new Error(`Unknown job type: ${jobType}`);
      }

      // Generate variant storage key
      const variantKey = this.generateVariantKey(
        fileMetadata.storageKey,
        suffix,
      );

      // Upload variant to storage
      await this.storageService.upload({
        key: variantKey,
        body: result.buffer,
        contentType: `image/${result.format}`,
      });

      // Create variant record
      const variant = this.fileVariantRepository.create({
        fileId,
        variantType,
        storageKey: variantKey,
        mimeType: `image/${result.format}`,
        sizeBytes: result.size,
        width: result.width,
        height: result.height,
      });

      await this.fileVariantRepository.save(variant);

      // Update job status
      await this.updateJobStatus(
        processingJobId,
        ProcessingJobStatus.COMPLETED,
        {
          variantKey,
          width: result.width,
          height: result.height,
          size: result.size,
          format: result.format,
        },
      );

      this.logger.log(`Completed image job: ${jobType} for file ${fileId}`);

      this.realtimeGateway.emitProcessingComplete(fileId, {
        jobType,
        // result
      });
    } catch (error) {
      this.logger.error(
        `Failed image job: ${jobType} for file ${fileId}`,
        error,
      );
      await this.updateJobStatus(
        processingJobId,
        ProcessingJobStatus.FAILED,
        undefined,
        error instanceof Error ? error.message : 'Unknown error',
      );

      this.realtimeGateway.emitProcessingError(
        fileId,
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }

  private generateVariantKey(originalKey: string, suffix: string): string {
    const parts = originalKey.split('/');
    const filename = parts.pop() || 'file';
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
    const ext = filename.includes('.') ? filename.split('.').pop() : 'jpg';
    parts.push(`${nameWithoutExt}-${suffix}.${ext}`);
    return parts.join('/');
  }
}
