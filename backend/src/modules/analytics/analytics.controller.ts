import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, ExportFormat } from './dto/analytics-query.dto';
import { Parser } from 'json2csv';

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

  @Get('vaccinations/compliance')
  async getVaccinationCompliance(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getVaccinationCompliance(query);
  }

  @Get('appointments/statistics')
  async getAppointmentStatistics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getAppointmentStatistics(query);
  }

  @Get('geographic/distribution')
  async getGeographicDistribution(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getGeographicDistribution(query);
  }

  @Get('dashboard')
  async getDashboardOverview(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getDashboardOverview(query);
  }

  @Get('export')
  async exportReport(
    @Query() query: AnalyticsQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.analyticsService.getDashboardOverview(query);
    const format = query.format || ExportFormat.JSON;

    if (format === ExportFormat.CSV) {
      const parser = new Parser();
      const csv = parser.parse([
        {
          metric: 'Total Users',
          value: data.users.totalUsers,
        },
        {
          metric: 'Active Users',
          value: data.users.activeUsers,
        },
        {
          metric: 'New Users',
          value: data.users.newUsers,
        },
        {
          metric: 'Total Pets',
          value: data.pets.totalPets,
        },
        {
          metric: 'New Pets',
          value: data.pets.newPets,
        },
        {
          metric: 'Total Vaccinations',
          value: data.vaccinations.totalVaccinations,
        },
        {
          metric: 'Vaccination Compliance Rate',
          value: `${data.vaccinations.complianceRate}%`,
        },
        {
          metric: 'Total Appointments',
          value: data.appointments.total,
        },
      ]);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=analytics-report-${Date.now()}.csv`,
      );
      return res.status(HttpStatus.OK).send(csv);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=analytics-report-${Date.now()}.json`,
    );
    return res.status(HttpStatus.OK).json(data);
  }
}
