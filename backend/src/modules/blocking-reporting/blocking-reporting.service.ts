import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Block } from './entities/block.entity';
import { Report, ReportStatus } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class BlockingReportingService {
  constructor(
    @InjectRepository(Block)
    private readonly blockRepository: Repository<Block>,
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
  ) {}

  // Block functionality
  async blockUser(blockerId: string, blockedId: string): Promise<Block> {
    if (blockerId === blockedId) {
      throw new ConflictException('Cannot block yourself');
    }

    const existingBlock = await this.blockRepository.findOne({
      where: { blockerId, blockedId },
    });

    if (existingBlock) {
      throw new ConflictException('User is already blocked');
    }

    const block = this.blockRepository.create({ blockerId, blockedId });
    return await this.blockRepository.save(block);
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const block = await this.blockRepository.findOne({
      where: { blockerId, blockedId },
    });

    if (!block) {
      throw new NotFoundException('Block not found');
    }

    await this.blockRepository.remove(block);
  }

  async getBlockedUsers(blockerId: string): Promise<Block[]> {
    return await this.blockRepository.find({
      where: { blockerId },
      order: { createdAt: 'DESC' },
    });
  }

  async isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const block = await this.blockRepository.findOne({
      where: { blockerId, blockedId },
    });
    return !!block;
  }

  // Report functionality
  async createReport(reporterId: string, createReportDto: CreateReportDto): Promise<Report> {
    const report = this.reportRepository.create({
      reporterId,
      ...createReportDto,
    });
    return await this.reportRepository.save(report);
  }

  async getReports(status?: ReportStatus): Promise<Report[]> {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    return await this.reportRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async updateReportStatus(id: string, status: ReportStatus): Promise<Report> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    report.status = status;
    return await this.reportRepository.save(report);
  }

  // Block enforcement
  async checkBlockAccess(viewerId: string, targetUserId: string): Promise<void> {
    const isBlocked = await this.isUserBlocked(targetUserId, viewerId);
    if (isBlocked) {
      throw new ForbiddenException('Access denied - you have been blocked by this user');
    }
  }
}