import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RecordShare, SharePermission } from '../entities/record-share.entity';
import { RecordShareAccess, AccessAction } from '../entities/record-share-access.entity';
import { MedicalRecord } from '../entities/medical-record.entity';
import {
  CreateRecordShareDto,
  UpdateRecordShareDto,
  ShareViaEmailDto,
  RecordShareResponseDto,
} from '../dto/record-share.dto';

export interface ShareAccessContext {
  userId?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class RecordShareService {
  constructor(
    @InjectRepository(RecordShare)
    private readonly shareRepository: Repository<RecordShare>,
    @InjectRepository(RecordShareAccess)
    private readonly accessLogRepository: Repository<RecordShareAccess>,
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepository: Repository<MedicalRecord>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate a secure random token for share links
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Build the shareable URL from token
   */
  private buildShareUrl(token: string): string {
    const baseUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    return `${baseUrl}/api/v1/medical-records/share/access/${token}`;
  }

  /**
   * Create a new share link for a medical record
   */
  async createShare(
    medicalRecordId: string,
    createdById: string,
    dto: CreateRecordShareDto,
  ): Promise<RecordShareResponseDto> {
    // Verify medical record exists
    const record = await this.medicalRecordRepository.findOne({
      where: { id: medicalRecordId },
      relations: ['pet'],
    });

    if (!record) {
      throw new NotFoundException(`Medical record ${medicalRecordId} not found`);
    }

    // Verify user owns the pet (authorization should be handled at controller level,
    // but we can add additional checks here)

    // Generate unique token
    const token = this.generateToken();

    // Calculate expiration
    let expiresAt: Date | null = null;
    if (dto.expiresInHours && dto.expiresInHours > 0) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + dto.expiresInHours);
    }

    const share = this.shareRepository.create({
      token,
      medicalRecordId,
      createdById,
      recipientEmail: dto.recipientEmail,
      recipientUserId: dto.recipientUserId,
      permission: dto.permission || SharePermission.VIEW,
      expiresAt,
      message: dto.message,
    });

    const savedShare = await this.shareRepository.save(share);

    return this.toResponseDto(Array.isArray(savedShare) ? savedShare[0] : savedShare);
  }

  /**
   * Get all shares for a medical record
   */
  async getSharesByRecord(medicalRecordId: string, userId: string): Promise<RecordShareResponseDto[]> {
    const shares = await this.shareRepository.find({
      where: { medicalRecordId, createdById: userId },
      order: { createdAt: 'DESC' },
    });

    return shares.map((share) => this.toResponseDto(share));
  }

  /**
   * Get all shares created by a user
   */
  async getSharesByUser(userId: string): Promise<RecordShareResponseDto[]> {
    const shares = await this.shareRepository.find({
      where: { createdById: userId },
      relations: ['medicalRecord', 'medicalRecord.pet'],
      order: { createdAt: 'DESC' },
    });

    return shares.map((share) => this.toResponseDto(share));
  }

  /**
   * Get a share by ID (for owner)
   */
  async getShareById(shareId: string, userId: string): Promise<RecordShare> {
    const share = await this.shareRepository.findOne({
      where: { id: shareId },
      relations: ['medicalRecord', 'medicalRecord.pet', 'accessLogs'],
    });

    if (!share) {
      throw new NotFoundException(`Share ${shareId} not found`);
    }

    if (share.createdById !== userId) {
      throw new ForbiddenException('You do not have access to this share');
    }

    return share;
  }

  /**
   * Validate a share token and return the medical record if valid
   */
  async validateAndAccessShare(
    token: string,
    context: ShareAccessContext,
    action: AccessAction = AccessAction.VIEW,
  ): Promise<{ share: RecordShare; medicalRecord: MedicalRecord }> {
    const share = await this.shareRepository.findOne({
      where: { token },
      relations: ['medicalRecord', 'medicalRecord.pet', 'medicalRecord.vet'],
    });

    if (!share) {
      throw new NotFoundException('Invalid or expired share link');
    }

    if (share.isRevoked()) {
      throw new ForbiddenException('This share link has been revoked');
    }

    if (share.isExpired()) {
      throw new ForbiddenException('This share link has expired');
    }

    // Check permission for edit actions
    if (action === AccessAction.EDIT && share.permission !== SharePermission.EDIT) {
      throw new ForbiddenException('This share link does not have edit permission');
    }

    // Log access
    await this.logAccess(share.id, action, context);

    // Update access count and last accessed
    await this.shareRepository.update(share.id, {
      accessCount: () => 'accessCount + 1',
      lastAccessedAt: new Date(),
    });

    return { share, medicalRecord: share.medicalRecord };
  }

  /**
   * Update share settings (permission, expiration)
   */
  async updateShare(
    shareId: string,
    userId: string,
    dto: UpdateRecordShareDto,
  ): Promise<RecordShareResponseDto> {
    const share = await this.getShareById(shareId, userId);

    if (dto.permission) {
      share.permission = dto.permission;
    }

    if (dto.expiresAt) {
      share.expiresAt = new Date(dto.expiresAt);
    }

    const updatedShare = await this.shareRepository.save(share);
    return this.toResponseDto(updatedShare);
  }

  /**
   * Revoke a share link
   */
  async revokeShare(shareId: string, userId: string): Promise<void> {
    const share = await this.getShareById(shareId, userId);

    if (share.isRevoked()) {
      throw new BadRequestException('Share is already revoked');
    }

    share.revokedAt = new Date();
    await this.shareRepository.save(share);
  }

  /**
   * Revoke all shares for a medical record
   */
  async revokeAllSharesForRecord(medicalRecordId: string, userId: string): Promise<number> {
    const result = await this.shareRepository.update(
      { medicalRecordId, createdById: userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    return result.affected || 0;
  }

  /**
   * Log an access event
   */
  async logAccess(
    shareId: string,
    action: AccessAction,
    context: ShareAccessContext,
  ): Promise<RecordShareAccess> {
    const accessLog = this.accessLogRepository.create({
      shareId,
      action,
      accessorUserId: context.userId,
      accessorEmail: context.email,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return await this.accessLogRepository.save(accessLog);
  }

  /**
   * Get access logs for a share
   */
  async getAccessLogs(shareId: string, userId: string): Promise<RecordShareAccess[]> {
    // Verify ownership
    await this.getShareById(shareId, userId);

    return await this.accessLogRepository.find({
      where: { shareId },
      order: { accessedAt: 'DESC' },
      take: 100,
    });
  }

  /**
   * Get access logs for a medical record (all shares)
   */
  async getAccessLogsByRecord(medicalRecordId: string, userId: string): Promise<RecordShareAccess[]> {
    const shares = await this.shareRepository.find({
      where: { medicalRecordId, createdById: userId },
      select: ['id'],
    });

    if (shares.length === 0) {
      return [];
    }

    const shareIds = shares.map((s) => s.id);

    return await this.accessLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.share', 'share')
      .where('log.shareId IN (:...shareIds)', { shareIds })
      .orderBy('log.accessedAt', 'DESC')
      .take(100)
      .getMany();
  }

  /**
   * Convert entity to response DTO
   */
  private toResponseDto(share: RecordShare): RecordShareResponseDto {
    return {
      id: share.id,
      token: share.token,
      shareUrl: this.buildShareUrl(share.token),
      medicalRecordId: share.medicalRecordId,
      recipientEmail: share.recipientEmail,
      permission: share.permission,
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
      isExpired: share.isExpired(),
      isRevoked: share.isRevoked(),
      accessCount: share.accessCount,
      lastAccessedAt: share.lastAccessedAt,
    };
  }

  /**
   * Cleanup expired shares (for scheduled task)
   */
  async cleanupExpiredShares(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.shareRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :cutoffDate', { cutoffDate })
      .andWhere('revokedAt IS NOT NULL OR expiresAt < :now', { now: new Date() })
      .execute();

    return result.affected || 0;
  }
}
