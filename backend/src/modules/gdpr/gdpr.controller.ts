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
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesService } from '../../auth/services/roles.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { RoleName } from '../../auth/constants/roles.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gdpr')
export class GdprController {
  constructor(
    private readonly gdprService: GdprService,
    private readonly rolesService: RolesService,
  ) {}

  /**
   * POST /gdpr/export — request a data export (own data, rate-limited 1/24h)
   */
  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
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
  requestErasure(
    @CurrentUser() user: User,
    @Body() dto: ErasureRequestDto,
  ) {
    return this.gdprService.requestErasure(user.id, dto.password);
  }

  /** GET /gdpr/users/:userId/consents */
  @Get('users/:userId/consents')
  async getConsents(
    @Param('userId') userId: string,
    @CurrentUser() caller: User,
  ) {
    await this.assertOwnerOrAdmin(caller, userId);
    return this.gdprService.getConsents(userId);
  }

  /** POST /gdpr/users/:userId/consents/init */
  @Post('users/:userId/consents/init')
  @HttpCode(HttpStatus.CREATED)
  async initConsents(
    @Param('userId') userId: string,
    @CurrentUser() caller: User,
  ) {
    await this.assertOwnerOrAdmin(caller, userId);
    return this.gdprService.initDefaultConsents(userId);
  }

  /** PATCH /gdpr/users/:userId/consents */
  @Patch('users/:userId/consents')
  async updateConsent(
    @Param('userId') userId: string,
    @CurrentUser() caller: User,
    @Body() dto: UpdateConsentDto,
    @Req() req: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.assertOwnerOrAdmin(caller, userId);
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
  async requestDeletion(
    @Param('userId') userId: string,
    @CurrentUser() caller: User,
    @Body() dto: RequestDeletionDto,
  ) {
    await this.assertOwnerOrAdmin(caller, userId);
    return this.gdprService.requestDeletion(userId, dto);
  }

  /** POST /gdpr/deletion-requests/:requestId/process — admin only */
  @Post('deletion-requests/:requestId/process')
  @Roles(RoleName.Admin)
  processDeletion(@Param('requestId') requestId: string) {
    return this.gdprService.processDeletion(requestId);
  }

  /** GET /gdpr/users/:userId/deletion-status */
  @Get('users/:userId/deletion-status')
  async getDeletionStatus(
    @Param('userId') userId: string,
    @CurrentUser() caller: User,
  ) {
    await this.assertOwnerOrAdmin(caller, userId);
    return this.gdprService.getDeletionStatus(userId);
  }

  /** GET /gdpr/users/:userId/export */
  @Get('users/:userId/export')
  async exportData(
    @Param('userId') userId: string,
    @CurrentUser() caller: User,
  ) {
    await this.assertOwnerOrAdmin(caller, userId);
    return this.gdprService.exportUserData(userId);
  }

  private async assertOwnerOrAdmin(caller: User, targetUserId: string): Promise<void> {
    if (caller.id === targetUserId) return;
    const roles = await this.rolesService.getUserRoles(caller.id);
    const isAdmin = roles.some((r) => r.name === RoleName.Admin);
    if (!isAdmin) {
      throw new ForbiddenException(
        'You are not allowed to access this resource',
      );
    }
  }
}
