import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { SmsService } from './sms.service';
import { SmsCostService } from './sms-cost.service';
import { SmsTemplateService } from './sms-template.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleName } from '../../auth/constants/roles.enum';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SetSpendingLimitDto } from './dto/set-spending-limit.dto';
import { ConfigService } from '@nestjs/config';
import * as twilio from 'twilio';

@Controller('sms')
export class SmsController {
  constructor(
    private readonly smsService: SmsService,
    private readonly smsCostService: SmsCostService,
    private readonly smsTemplateService: SmsTemplateService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get current user's SMS usage for the month
   * GET /sms/usage
   */
  @Get('usage')
  @UseGuards(JwtAuthGuard)
  async getMyUsage(
    @CurrentUser('id') userId: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const m = month ? parseInt(month, 10) : undefined;
    const y = year ? parseInt(year, 10) : undefined;
    return this.smsCostService.getUserUsage(userId, m, y);
  }

  /**
   * Admin: Get SMS stats for dashboard
   * GET /sms/admin/stats
   */
  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.Admin)
  async getAdminStats(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const m = month ? parseInt(month, 10) : undefined;
    const y = year ? parseInt(year, 10) : undefined;
    return this.smsCostService.getAdminStats(m, y);
  }

  /**
   * Admin: Set spending limit for a user
   * PATCH /sms/admin/limits/:userId
   */
  @Patch('admin/limits/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.Admin)
  async setUserLimit(
    @Param('userId') targetUserId: string,
    @Body() dto: SetSpendingLimitDto,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const m = month ? parseInt(month, 10) : undefined;
    const y = year ? parseInt(year, 10) : undefined;
    return this.smsCostService.setUserSpendingLimit(
      targetUserId,
      dto.limitCents,
      m,
      y,
    );
  }

  /**
   * Admin: List SMS templates
   * GET /sms/admin/templates
   */
  @Get('admin/templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.Admin)
  async listTemplates() {
    return this.smsTemplateService.findAll();
  }

  /**
   * Twilio status callback webhook
   * POST /sms/webhook/status
   * Validates X-Twilio-Signature when auth token is configured
   */
  @Post('webhook/status')
  async webhookStatus(
    @Body() body: { MessageSid?: string; MessageStatus?: string; ErrorCode?: string; ErrorMessage?: string; MessagePrice?: string },
    @Req() req: Request,
  ) {
    const authToken = this.configService.get<string>('sms.twilioAuthToken');
    if (authToken) {
      const signature = req.headers['x-twilio-signature'] as string;
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const isValid = twilio.validateRequest(
        authToken,
        signature,
        url,
        req.body as Record<string, string>,
      );
      if (!isValid) {
        return { success: false, error: 'Invalid signature' };
      }
    }

    if (!body.MessageSid || !body.MessageStatus) {
      return { success: false, error: 'Missing MessageSid or MessageStatus' };
    }
    const costCents = body.MessagePrice ? parseFloat(body.MessagePrice) * 100 : undefined;
    await this.smsService.updateDeliveryStatus(
      body.MessageSid,
      body.MessageStatus,
      body.ErrorCode,
      body.ErrorMessage,
      costCents,
    );
    return { success: true };
  }
}
