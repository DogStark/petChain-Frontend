import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GdprRequest, GdprRequestStatus, GdprRequestType } from './entities/gdpr-request.entity';
import { GdprService } from './gdpr.service';

export interface GdprJobData {
  requestId: string;
  userId: string;
  type: GdprRequestType;
}

@Processor('gdpr')
@Injectable()
export class GdprProcessor extends WorkerHost {
  private readonly logger = new Logger(GdprProcessor.name);

  constructor(
    @InjectRepository(GdprRequest)
    private readonly gdprRequestRepo: Repository<GdprRequest>,
    private readonly gdprService: GdprService,
  ) {
    super();
  }

  async process(job: Job<GdprJobData>): Promise<void> {
    const { requestId, userId, type } = job.data;
    this.logger.log(`Processing GDPR ${type} job for user ${userId}`);

    const request = await this.gdprRequestRepo.findOne({ where: { id: requestId } });
    if (!request) return;

    request.status = GdprRequestStatus.PROCESSING;
    await this.gdprRequestRepo.save(request);

    try {
      if (type === GdprRequestType.EXPORT) {
        const url = await this.gdprService.processExportJob(userId, requestId);
        request.downloadUrl = url;
      } else {
        await this.gdprService.processErasureJob(userId, requestId);
      }
      request.status = GdprRequestStatus.COMPLETED;
      request.completedAt = new Date();
    } catch (err) {
      this.logger.error(`GDPR ${type} failed for user ${userId}: ${err.message}`);
      request.status = GdprRequestStatus.FAILED;
    }

    await this.gdprRequestRepo.save(request);
  }
}
