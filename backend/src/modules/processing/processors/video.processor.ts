import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VideoProcessingService } from '../services/video-processing.service';
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
 * Video processing job data
 */
export interface VideoJobData {
  fileId: string;
  processingJobId: string;
  jobType: ProcessingJobType;
  options?: {
    width?: number;
    height?: number;
    duration?: number;
    quality?: 'low' | 'medium' | 'high';
    format?: 'mp4' | 'webm';
  };
}

/**
 * Video Processor
 *
 * BullMQ processor for video processing jobs.
 */
@Processor('video-processing')
export class VideoProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessor.name);

  constructor(
    private readonly videoProcessingService: VideoProcessingService,
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

  async process(job: Job<VideoJobData>): Promise<void> {
    const { fileId, processingJobId, jobType, options } = job.data;

    this.logger.log(`Processing video job: ${jobType} for file ${fileId}`);

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

      // Process based on job type
      switch (jobType) {
        case ProcessingJobType.VIDEO_THUMBNAIL:
          await this.processThumbnail(
            fileId,
            processingJobId,
            originalFile.body,
            fileMetadata,
          );
          break;

        case ProcessingJobType.VIDEO_PREVIEW:
          await this.processPreview(
            fileId,
            processingJobId,
            originalFile.body,
            fileMetadata,
            options,
          );
          break;

        case ProcessingJobType.VIDEO_TRANSCODE:
          await this.processTranscode(
            fileId,
            processingJobId,
            originalFile.body,
            fileMetadata,
            options,
          );
          break;

        case ProcessingJobType.STRIP_METADATA:
          await this.processStripMetadata(
            fileId,
            processingJobId,
            originalFile.body,
            fileMetadata,
          );
          break;

        default:
          throw new Error(`Unknown job type: ${jobType}`);
      }

      this.logger.log(`Completed video job: ${jobType} for file ${fileId}`);

      this.realtimeGateway.emitProcessingComplete(fileId, {
        jobType,
        // result
      });
    } catch (error) {
      this.logger.error(
        `Failed video job: ${jobType} for file ${fileId}`,
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

  private async processThumbnail(
    fileId: string,
    jobId: string,
    buffer: Buffer,
    fileMetadata: FileMetadata,
  ): Promise<void> {
    const thumbnailBuffer =
      await this.videoProcessingService.extractThumbnail(buffer);

    const variantKey = this.generateVariantKey(
      fileMetadata.storageKey,
      'thumb',
      'jpg',
    );

    await this.storageService.upload({
      key: variantKey,
      body: thumbnailBuffer,
      contentType: 'image/jpeg',
    });

    const variant = this.fileVariantRepository.create({
      fileId,
      variantType: VariantType.THUMBNAIL,
      storageKey: variantKey,
      mimeType: 'image/jpeg',
      sizeBytes: thumbnailBuffer.length,
      width: 320,
      height: 180,
    });

    await this.fileVariantRepository.save(variant);

    await this.updateJobStatus(jobId, ProcessingJobStatus.COMPLETED, {
      variantKey,
      size: thumbnailBuffer.length,
      format: 'jpeg',
    });
  }

  private async processPreview(
    fileId: string,
    jobId: string,
    buffer: Buffer,
    fileMetadata: FileMetadata,
    options?: VideoJobData['options'],
  ): Promise<void> {
    const result = await this.videoProcessingService.generatePreview(buffer, {
      width: options?.width,
      height: options?.height,
      duration: options?.duration,
    });

    const variantKey = this.generateVariantKey(
      fileMetadata.storageKey,
      'preview',
      'mp4',
    );

    await this.storageService.upload({
      key: variantKey,
      body: result.buffer,
      contentType: 'video/mp4',
    });

    const variant = this.fileVariantRepository.create({
      fileId,
      variantType: VariantType.PREVIEW,
      storageKey: variantKey,
      mimeType: 'video/mp4',
      sizeBytes: result.size,
      width: result.width,
      height: result.height,
    });

    await this.fileVariantRepository.save(variant);

    await this.updateJobStatus(jobId, ProcessingJobStatus.COMPLETED, {
      variantKey,
      width: result.width,
      height: result.height,
      size: result.size,
      duration: result.duration,
      format: 'mp4',
    });
  }

  private async processTranscode(
    fileId: string,
    jobId: string,
    buffer: Buffer,
    fileMetadata: FileMetadata,
    options?: VideoJobData['options'],
  ): Promise<void> {
    const format = options?.format || 'mp4';
    const result = await this.videoProcessingService.transcode(buffer, {
      width: options?.width,
      height: options?.height,
      quality: options?.quality,
      format,
    });

    const variantKey = this.generateVariantKey(
      fileMetadata.storageKey,
      'transcoded',
      format,
    );

    await this.storageService.upload({
      key: variantKey,
      body: result.buffer,
      contentType: `video/${format}`,
    });

    const variant = this.fileVariantRepository.create({
      fileId,
      variantType: VariantType.TRANSCODED,
      storageKey: variantKey,
      mimeType: `video/${format}`,
      sizeBytes: result.size,
      width: result.width,
      height: result.height,
    });

    await this.fileVariantRepository.save(variant);

    await this.updateJobStatus(jobId, ProcessingJobStatus.COMPLETED, {
      variantKey,
      width: result.width,
      height: result.height,
      size: result.size,
      duration: result.duration,
      format,
    });
  }

  private async processStripMetadata(
    fileId: string,
    jobId: string,
    buffer: Buffer,
    fileMetadata: FileMetadata,
  ): Promise<void> {
    const strippedBuffer =
      await this.videoProcessingService.stripMetadata(buffer);

    // Update original file in place
    await this.storageService.upload({
      key: fileMetadata.storageKey,
      body: strippedBuffer,
      contentType: fileMetadata.mimeType,
    });

    await this.updateJobStatus(jobId, ProcessingJobStatus.COMPLETED, {
      size: strippedBuffer.length,
    });
  }

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

  private generateVariantKey(
    originalKey: string,
    suffix: string,
    extension: string,
  ): string {
    const parts = originalKey.split('/');
    const filename = parts.pop() || 'file';
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
    parts.push(`${nameWithoutExt}-${suffix}.${extension}`);
    return parts.join('/');
  }
}
