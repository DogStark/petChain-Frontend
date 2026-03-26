import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ProcessingJob,
  ProcessingJobStatus,
  ProcessingJobType,
} from './entities/processing-job.entity';
import { FileMetadata } from '../upload/entities/file-metadata.entity';
import { FileType } from '../upload/entities/file-type.enum';

/**
 * Processing options
 */
export interface ProcessingOptions {
  generateThumbnail?: boolean;
  compress?: boolean;
  convertToWebP?: boolean;
  addWatermark?: boolean;
  stripMetadata?: boolean;
  // Video specific
  generatePreview?: boolean;
  transcode?: boolean;
}

/**
 * Processing Service
 *
 * Manages media processing jobs and queues.
 */
@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);

  constructor(
    @InjectRepository(ProcessingJob)
    private readonly processingJobRepository: Repository<ProcessingJob>,
    @InjectRepository(FileMetadata)
    private readonly fileMetadataRepository: Repository<FileMetadata>,
    @InjectQueue('image-processing')
    private readonly imageQueue: Queue,
    @InjectQueue('video-processing')
    private readonly videoQueue: Queue,
  ) {}

  /**
   * Queue processing jobs for a file
   */
  async queueProcessing(
    fileId: string,
    options: ProcessingOptions = {},
  ): Promise<ProcessingJob[]> {
    const fileMetadata = await this.fileMetadataRepository.findOne({
      where: { id: fileId },
    });

    if (!fileMetadata) {
      throw new Error(`File not found: ${fileId}`);
    }

    const jobs: ProcessingJob[] = [];

    if (fileMetadata.fileType === FileType.IMAGE) {
      jobs.push(...(await this.queueImageJobs(fileId, options)));
    } else if (fileMetadata.fileType === FileType.VIDEO) {
      jobs.push(...(await this.queueVideoJobs(fileId, options)));
    }

    this.logger.log(`Queued ${jobs.length} processing jobs for file ${fileId}`);

    return jobs;
  }

  /**
   * Queue image processing jobs
   */
  private async queueImageJobs(
    fileId: string,
    options: ProcessingOptions,
  ): Promise<ProcessingJob[]> {
    const jobs: ProcessingJob[] = [];

    // Default: strip metadata first
    if (options.stripMetadata !== false) {
      const job = await this.createAndQueueJob(
        fileId,
        ProcessingJobType.STRIP_METADATA,
        this.imageQueue,
        { priority: 1 },
      );
      jobs.push(job);
    }

    // Generate thumbnail
    if (options.generateThumbnail !== false) {
      const job = await this.createAndQueueJob(
        fileId,
        ProcessingJobType.IMAGE_THUMBNAIL,
        this.imageQueue,
        { priority: 2 },
      );
      jobs.push(job);
    }

    // Compress
    if (options.compress !== false) {
      const job = await this.createAndQueueJob(
        fileId,
        ProcessingJobType.IMAGE_COMPRESS,
        this.imageQueue,
        { priority: 3 },
      );
      jobs.push(job);
    }

    // Convert to WebP
    if (options.convertToWebP) {
      const job = await this.createAndQueueJob(
        fileId,
        ProcessingJobType.IMAGE_WEBP,
        this.imageQueue,
        { priority: 4 },
      );
      jobs.push(job);
    }

    // Add watermark
    if (options.addWatermark) {
      const job = await this.createAndQueueJob(
        fileId,
        ProcessingJobType.IMAGE_WATERMARK,
        this.imageQueue,
        { priority: 5 },
      );
      jobs.push(job);
    }

    return jobs;
  }

  /**
   * Queue video processing jobs
   */
  private async queueVideoJobs(
    fileId: string,
    options: ProcessingOptions,
  ): Promise<ProcessingJob[]> {
    const jobs: ProcessingJob[] = [];

    // Strip metadata first
    if (options.stripMetadata !== false) {
      const job = await this.createAndQueueJob(
        fileId,
        ProcessingJobType.STRIP_METADATA,
        this.videoQueue,
        { priority: 1 },
      );
      jobs.push(job);
    }

    // Generate thumbnail
    if (options.generateThumbnail !== false) {
      const job = await this.createAndQueueJob(
        fileId,
        ProcessingJobType.VIDEO_THUMBNAIL,
        this.videoQueue,
        { priority: 2 },
      );
      jobs.push(job);
    }

    // Generate preview
    if (options.generatePreview !== false) {
      const job = await this.createAndQueueJob(
        fileId,
        ProcessingJobType.VIDEO_PREVIEW,
        this.videoQueue,
        { priority: 3 },
      );
      jobs.push(job);
    }

    // Transcode
    if (options.transcode) {
      const job = await this.createAndQueueJob(
        fileId,
        ProcessingJobType.VIDEO_TRANSCODE,
        this.videoQueue,
        { priority: 4 },
      );
      jobs.push(job);
    }

    return jobs;
  }

  /**
   * Create and queue a processing job
   */
  private async createAndQueueJob(
    fileId: string,
    type: ProcessingJobType,
    queue: Queue,
    options: { priority?: number; options?: Record<string, unknown> } = {},
  ): Promise<ProcessingJob> {
    // Create job record
    const processingJob = this.processingJobRepository.create({
      fileId,
      type,
      status: ProcessingJobStatus.PENDING,
      options: options.options,
    });

    const savedJob = await this.processingJobRepository.save(processingJob);

    // Add to queue
    await queue.add(
      type,
      {
        fileId,
        processingJobId: savedJob.id,
        jobType: type,
        options: options.options,
      },
      {
        priority: options.priority || 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    this.logger.debug(`Queued job ${savedJob.id} (${type}) for file ${fileId}`);

    return savedJob;
  }

  /**
   * Get processing jobs for a file
   */
  async getJobsForFile(fileId: string): Promise<ProcessingJob[]> {
    return this.processingJobRepository.find({
      where: { fileId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<ProcessingJob | null> {
    return this.processingJobRepository.findOne({
      where: { id: jobId },
    });
  }

  /**
   * Cancel pending jobs for a file
   */
  async cancelJobsForFile(fileId: string): Promise<number> {
    const result = await this.processingJobRepository.update(
      { fileId, status: ProcessingJobStatus.PENDING },
      { status: ProcessingJobStatus.CANCELLED },
    );

    return result.affected || 0;
  }

  /**
   * Retry failed job
   */
  async retryJob(jobId: string): Promise<ProcessingJob> {
    const job = await this.processingJobRepository.findOne({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status !== ProcessingJobStatus.FAILED) {
      throw new Error(`Job is not in failed state: ${job.status}`);
    }

    // Reset job
    job.status = ProcessingJobStatus.PENDING;
    job.attempts += 1;
    job.errorMessage = '';
    await this.processingJobRepository.save(job);

    // Re-queue
    const queue = this.isVideoJob(job.type) ? this.videoQueue : this.imageQueue;
    await queue.add(job.type, {
      fileId: job.fileId,
      processingJobId: job.id,
      jobType: job.type,
      options: job.options,
    });

    return job;
  }

  /**
   * Check if job type is video
   */
  private isVideoJob(type: ProcessingJobType): boolean {
    return [
      ProcessingJobType.VIDEO_THUMBNAIL,
      ProcessingJobType.VIDEO_PREVIEW,
      ProcessingJobType.VIDEO_TRANSCODE,
    ].includes(type);
  }

  /**
   * Get processing statistics
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const [pending, processing, completed, failed] = await Promise.all([
      this.processingJobRepository.count({
        where: { status: ProcessingJobStatus.PENDING },
      }),
      this.processingJobRepository.count({
        where: { status: ProcessingJobStatus.PROCESSING },
      }),
      this.processingJobRepository.count({
        where: { status: ProcessingJobStatus.COMPLETED },
      }),
      this.processingJobRepository.count({
        where: { status: ProcessingJobStatus.FAILED },
      }),
    ]);

    return { pending, processing, completed, failed };
  }
}
