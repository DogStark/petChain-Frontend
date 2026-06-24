import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { GdprService } from './gdpr.service';
import { UpdateConsentDto, RequestDeletionDto } from './dto/gdpr.dto';
import { DataExportRequestDto } from './dto/data-export-request.dto';
import { ErasureRequestDto } from './dto/erasure-request.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('gdpr')
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  /**
   * POST /gdpr/export — request a data export (own data, rate-limited 1/24h)
   */
  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard)
  requestExport(
    @CurrentUser() user: User,
    @Body() _dto: DataExportRequestDto,
  ) {
    return this.gdprService.requestExport(user.id);
  }

  /**
   * POST /gdpr/erase — request account erasure with password confirmation (rate-limited 1/24h)
   */
  @Post('erase')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard)
  requestErasure(
    @CurrentUser() user: User,
    @Body() dto: ErasureRequestDto,
  ) {
    return this.gdprService.requestErasure(user.id, dto.password);
  }

  /** GET /gdpr/users/:userId/consents */
  @Get('users/:userId/consents')
  getConsents(@Param('userId') userId: string) {
    return this.gdprService.getConsents(userId);
  }

  /** POST /gdpr/users/:userId/consents/init */
  @Post('users/:userId/consents/init')
  @HttpCode(HttpStatus.CREATED)
  initConsents(@Param('userId') userId: string) {
    return this.gdprService.initDefaultConsents(userId);
  }

  /** PATCH /gdpr/users/:userId/consents */
  @Patch('users/:userId/consents')
  updateConsent(
    @Param('userId') userId: string,
    @Body() dto: UpdateConsentDto,
    @Req() req: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ??
      req.socket.remoteAddress ??
      null;
    return this.gdprService.updateConsent(
      userId,
      dto,
      ip ?? undefined,
      userAgent,
    );
  }

  /** POST /gdpr/users/:userId/deletion-request */
  @Post('users/:userId/deletion-request')
  @HttpCode(HttpStatus.CREATED)
  requestDeletion(
    @Param('userId') userId: string,
    @Body() dto: RequestDeletionDto,
  ) {
    return this.gdprService.requestDeletion(userId, dto);
  }

  /** POST /gdpr/deletion-requests/:requestId/process */
  @Post('deletion-requests/:requestId/process')
  processDeletion(@Param('requestId') requestId: string) {
    return this.gdprService.processDeletion(requestId);
  }

  /** GET /gdpr/users/:userId/deletion-status */
  @Get('users/:userId/deletion-status')
  getDeletionStatus(@Param('userId') userId: string) {
    return this.gdprService.getDeletionStatus(userId);
  }

  /** GET /gdpr/users/:userId/export */
  @Get('users/:userId/export')
  exportData(@Param('userId') userId: string) {
    return this.gdprService.exportUserData(userId);
  }
}
