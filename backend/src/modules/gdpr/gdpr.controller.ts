import {
  Body,
  Controller,
  ForbiddenException,
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

  private assertOwner(currentUser: User, userId: string) {
    if (currentUser.id !== userId) {
      throw new ForbiddenException('Cannot access another user\'s GDPR data');
    }
  }

  /** GET /gdpr/users/:userId/consents */
  @Get('users/:userId/consents')
  @UseGuards(JwtAuthGuard)
  getConsents(@Param('userId') userId: string, @CurrentUser() user: User) {
    this.assertOwner(user, userId);
    return this.gdprService.getConsents(userId);
  }

  /** POST /gdpr/users/:userId/consents/init */
  @Post('users/:userId/consents/init')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  initConsents(@Param('userId') userId: string, @CurrentUser() user: User) {
    this.assertOwner(user, userId);
    return this.gdprService.initDefaultConsents(userId);
  }

  /** PATCH /gdpr/users/:userId/consents */
  @Patch('users/:userId/consents')
  @UseGuards(JwtAuthGuard)
  updateConsent(
    @Param('userId') userId: string,
    @Body() dto: UpdateConsentDto,
    @Req() req: Request,
    @CurrentUser() user: User,
    @Headers('user-agent') userAgent?: string,
  ) {
    this.assertOwner(user, userId);
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
  @UseGuards(JwtAuthGuard)
  requestDeletion(
    @Param('userId') userId: string,
    @Body() dto: RequestDeletionDto,
    @CurrentUser() user: User,
  ) {
    this.assertOwner(user, userId);
    return this.gdprService.requestDeletion(userId, dto);
  }

  /** POST /gdpr/deletion-requests/:requestId/process */
  @Post('deletion-requests/:requestId/process')
  @UseGuards(JwtAuthGuard)
  processDeletion(@Param('requestId') requestId: string) {
    return this.gdprService.processDeletion(requestId);
  }

  /** GET /gdpr/users/:userId/deletion-status */
  @Get('users/:userId/deletion-status')
  @UseGuards(JwtAuthGuard)
  getDeletionStatus(@Param('userId') userId: string, @CurrentUser() user: User) {
    this.assertOwner(user, userId);
    return this.gdprService.getDeletionStatus(userId);
  }

  /** GET /gdpr/users/:userId/export */
  @Get('users/:userId/export')
  @UseGuards(JwtAuthGuard)
  exportData(@Param('userId') userId: string, @CurrentUser() user: User) {
    this.assertOwner(user, userId);
    return this.gdprService.exportUserData(userId);
  }
}
