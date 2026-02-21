import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Ip,
  Headers,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { RecordShareService, ShareAccessContext } from '../services/record-share.service';
import {
  CreateRecordShareDto,
  UpdateRecordShareDto,
  ShareViaEmailDto,
} from '../dto/record-share.dto';
import { AccessAction } from '../entities/record-share-access.entity';
import { EmailService } from '../../email/email.service';
import { EmailType } from '../../email/entities/email-log.entity';

@Controller('medical-records')
export class RecordShareController {
  constructor(
    private readonly shareService: RecordShareService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Create a shareable link for a medical record
   * POST /medical-records/:recordId/share
   */
  @Post(':recordId/share')
  @UseGuards(JwtAuthGuard)
  async createShare(
    @Param('recordId') recordId: string,
    @Body() dto: CreateRecordShareDto,
    @CurrentUser() user: User,
  ) {
    return this.shareService.createShare(recordId, user.id, dto);
  }

  /**
   * Get all shares for a specific medical record
   * GET /medical-records/:recordId/shares
   */
  @Get(':recordId/shares')
  @UseGuards(JwtAuthGuard)
  async getSharesByRecord(
    @Param('recordId') recordId: string,
    @CurrentUser() user: User,
  ) {
    return this.shareService.getSharesByRecord(recordId, user.id);
  }

  /**
   * Get all shares created by current user
   * GET /medical-records/shares/my
   */
  @Get('shares/my')
  @UseGuards(JwtAuthGuard)
  async getMyShares(@CurrentUser() user: User) {
    return this.shareService.getSharesByUser(user.id);
  }

  /**
   * Get a specific share details (owner only)
   * GET /medical-records/share/:shareId
   */
  @Get('share/:shareId')
  @UseGuards(JwtAuthGuard)
  async getShareDetails(
    @Param('shareId') shareId: string,
    @CurrentUser() user: User,
  ) {
    const share = await this.shareService.getShareById(shareId, user.id);
    return {
      id: share.id,
      token: share.token,
      medicalRecordId: share.medicalRecordId,
      recipientEmail: share.recipientEmail,
      permission: share.permission,
      expiresAt: share.expiresAt,
      revokedAt: share.revokedAt,
      accessCount: share.accessCount,
      lastAccessedAt: share.lastAccessedAt,
      createdAt: share.createdAt,
      medicalRecord: share.medicalRecord,
    };
  }

  /**
   * Update share settings (permission, expiration)
   * PATCH /medical-records/share/:shareId
   */
  @Patch('share/:shareId')
  @UseGuards(JwtAuthGuard)
  async updateShare(
    @Param('shareId') shareId: string,
    @Body() dto: UpdateRecordShareDto,
    @CurrentUser() user: User,
  ) {
    return this.shareService.updateShare(shareId, user.id, dto);
  }

  /**
   * Revoke a share link
   * DELETE /medical-records/share/:shareId
   */
  @Delete('share/:shareId')
  @UseGuards(JwtAuthGuard)
  async revokeShare(
    @Param('shareId') shareId: string,
    @CurrentUser() user: User,
  ) {
    await this.shareService.revokeShare(shareId, user.id);
    return { message: 'Share link revoked successfully' };
  }

  /**
   * Revoke all shares for a medical record
   * DELETE /medical-records/:recordId/shares
   */
  @Delete(':recordId/shares')
  @UseGuards(JwtAuthGuard)
  async revokeAllShares(
    @Param('recordId') recordId: string,
    @CurrentUser() user: User,
  ) {
    const count = await this.shareService.revokeAllSharesForRecord(recordId, user.id);
    return { message: `${count} share link(s) revoked` };
  }

  /**
   * Share via email
   * POST /medical-records/:recordId/share/email
   */
  @Post(':recordId/share/email')
  @UseGuards(JwtAuthGuard)
  async shareViaEmail(
    @Param('recordId') recordId: string,
    @Body() dto: ShareViaEmailDto,
    @CurrentUser() user: User,
  ) {
    // Create the share
    const share = await this.shareService.createShare(recordId, user.id, {
      recipientEmail: dto.recipientEmail,
      permission: dto.permission,
      expiresInHours: dto.expiresInHours,
      message: dto.message,
    });

    // Send email
    await this.emailService.queueEmail({
      type: EmailType.SYSTEM_NOTIFICATION,
      recipientEmail: dto.recipientEmail,
      subject: dto.subject || `${user.firstName} shared a medical record with you`,
      htmlBody: this.buildShareEmailHtml(share.shareUrl, user, dto.message, share.expiresAt),
      metadata: {
        shareId: share.id,
        medicalRecordId: recordId,
        sharedById: user.id,
      },
    });

    return {
      ...share,
      emailSent: true,
    };
  }

  /**
   * Get access logs for a share
   * GET /medical-records/share/:shareId/logs
   */
  @Get('share/:shareId/logs')
  @UseGuards(JwtAuthGuard)
  async getShareAccessLogs(
    @Param('shareId') shareId: string,
    @CurrentUser() user: User,
  ) {
    return this.shareService.getAccessLogs(shareId, user.id);
  }

  /**
   * Get all access logs for a medical record
   * GET /medical-records/:recordId/access-logs
   */
  @Get(':recordId/access-logs')
  @UseGuards(JwtAuthGuard)
  async getRecordAccessLogs(
    @Param('recordId') recordId: string,
    @CurrentUser() user: User,
  ) {
    return this.shareService.getAccessLogsByRecord(recordId, user.id);
  }

  /**
   * Access a shared medical record (public endpoint)
   * GET /medical-records/share/access/:token
   */
  @Get('share/access/:token')
  async accessSharedRecord(
    @Param('token') token: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Query('action') action?: AccessAction,
  ) {
    const context: ShareAccessContext = {
      ipAddress: ip,
      userAgent,
    };

    const { share, medicalRecord } = await this.shareService.validateAndAccessShare(
      token,
      context,
      action || AccessAction.VIEW,
    );

    return {
      permission: share.permission,
      expiresAt: share.expiresAt,
      medicalRecord: {
        id: medicalRecord.id,
        recordType: medicalRecord.recordType,
        date: medicalRecord.date,
        diagnosis: medicalRecord.diagnosis,
        treatment: medicalRecord.treatment,
        notes: medicalRecord.notes,
        attachments: medicalRecord.attachments,
        pet: medicalRecord.pet ? {
          name: medicalRecord.pet.name,
          species: medicalRecord.pet.species,
          breed: medicalRecord.pet.breed,
        } : undefined,
        vet: medicalRecord.vet ? {
          name: medicalRecord.vet.name,
          clinicName: medicalRecord.vet.clinicName,
        } : undefined,
      },
    };
  }

  /**
   * Build HTML email content for share notification
   */
  private buildShareEmailHtml(
    shareUrl: string,
    sender: User,
    message?: string,
    expiresAt?: Date,
  ): string {
    const expiryText = expiresAt
      ? `This link will expire on ${expiresAt.toLocaleDateString()}.`
      : 'This link does not expire.';

    const messageHtml = message
      ? `<p style="margin: 16px 0; padding: 12px; background: #f5f5f5; border-radius: 8px;">"${message}"</p>`
      : '';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Medical Record Shared With You</h2>
        <p>${sender.firstName} ${sender.lastName} has shared a pet medical record with you.</p>
        ${messageHtml}
        <p>
          <a href="${shareUrl}" 
             style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
            View Medical Record
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">${expiryText}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">
          This email was sent by PetChain. If you didn't expect this, you can safely ignore it.
        </p>
      </div>
    `;
  }
}
