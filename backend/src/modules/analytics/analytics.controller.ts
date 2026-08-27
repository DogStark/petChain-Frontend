import {
  Controller,
  Get,
  HttpStatus,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('users')
  async getUserMetrics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getUserMetrics(query);
  }

  @Get('pets/trends')
  async getPetRegistrationTrends(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getPetRegistrationTrends(query);
  }

  @Get('health/trends')
  async getPetHealthTrends(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getPetHealthTrends(query);
  }

  @Get('vaccinations/compliance')
  async getVaccinationCompliance(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getVaccinationCompliance(query);
  }

  @Get('appointments/statistics')
  async getAppointmentStatistics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getAppointmentStatistics(query);
  }

  @Get('usage/system')
  async getSystemUsageAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getSystemUsageAnalytics(query);
  }

  @Get('geographic/distribution')
  async getGeographicDistribution(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getGeographicDistribution(query);
  }

  @Get('reports/custom')
  async getCustomReport(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.generateCustomReport(query);
  }

  @Get('dashboard')
  async getDashboardOverview(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getDashboardOverview(query);
  }

  @Get('export')
  async exportReport(@Query() query: AnalyticsQueryDto, @Res() res: Response) {
    const exportResult = await this.analyticsService.exportReport(query);

    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${exportResult.filename}`,
    );

    if (exportResult.contentType === 'application/json') {
      return res.status(HttpStatus.OK).json(exportResult.body);
    }

    return res.status(HttpStatus.OK).send(exportResult.body);
  }
}
