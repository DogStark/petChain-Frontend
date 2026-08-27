import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Patch,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BlockingReportingService } from './blocking-reporting.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportStatus } from './entities/report.entity';

@Controller()
@UseGuards(JwtAuthGuard)
export class BlockingReportingController {
  constructor(
    private readonly blockingReportingService: BlockingReportingService,
  ) {}

  // Block endpoints
  @Post('blocking/block/:userId')
  async blockUser(
    @Param('userId') userId: string,
    @Request() req: any,
  ) {
    return this.blockingReportingService.blockUser(req.user.id, userId);
  }

  @Delete('blocking/block/:userId')
  async unblockUser(
    @Param('userId') userId: string,
    @Request() req: any,
  ) {
    return this.blockingReportingService.unblockUser(req.user.id, userId);
  }

  @Get('blocking/blocked')
  async getBlockedUsers(@Request() req: any) {
    return this.blockingReportingService.getBlockedUsers(req.user.id);
  }

  // Report endpoints
  @Post('reporting/report')
  async createReport(
    @Body() createReportDto: CreateReportDto,
    @Request() req: any,
  ) {
    return this.blockingReportingService.createReport(req.user.id, createReportDto);
  }

  @Get('reporting/reports')
  async getReports(
    @Request() req: any,
    @Query('status') status?: ReportStatus,
  ) {
    // Admin only - implement role check as needed
    return this.blockingReportingService.getReports(status);
  }

  @Patch('reporting/reports/:id/status')
  async updateReportStatus(
    @Param('id') id: string,
    @Body('status') status: ReportStatus,
    @Request() req: any,
  ) {
    // Admin only - implement role check as needed
    return this.blockingReportingService.updateReportStatus(id, status);
  }
}