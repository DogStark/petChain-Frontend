import {
    Controller,
    Post,
    Body,
    UseGuards,
    Get,
    Param,
    Patch,
    Query,
} from '@nestjs/common';
import { ReportService } from '../services/report.service';
import { CreateReportDto } from '../dto/create-report.dto';
import { ReportFilterDto } from '../dto/report-filter.dto';
import { UpdateReportStatusDto } from '../dto/update-report-status.dto';
import { StatisticsQueryDto } from '../dto/statistics-query.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { RoleName } from '../../../auth/constants/roles.enum';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportController {
    constructor(private readonly reportService: ReportService) { }

    @Post()
    async createReport(
        @CurrentUser('id') userId: string,
        @Body() createReportDto: CreateReportDto,
    ) {
        return this.reportService.createReport(userId, createReportDto);
    }

    @Get()
    @UseGuards(RolesGuard)
    @Roles(RoleName.Admin)
    async getReports(
        @Query() filterDto: ReportFilterDto,
        @Query('limit') limit: number = 10,
        @Query('page') page: number = 1,
    ) {
        return this.reportService.getReports(filterDto, limit, page);
    }

    @Get('statistics')
    @UseGuards(RolesGuard)
    @Roles(RoleName.Admin)
    async getReportStatistics(@Query() queryDto: StatisticsQueryDto) {
        return this.reportService.getReportStatistics(queryDto);
    }

    @Get(':id')
    @UseGuards(RolesGuard)
    @Roles(RoleName.Admin)
    async getReportById(@Param('id') id: string) {
        return this.reportService.getReportById(id);
    }

    @Patch(':id/status')
    @UseGuards(RolesGuard)
    @Roles(RoleName.Admin)
    async updateReportStatus(
        @CurrentUser('id') adminId: string,
        @Param('id') reportId: string,
        @Body() updateDto: UpdateReportStatusDto,
        @Body('note') note?: string,
    ) {
        return this.reportService.updateReportStatus(adminId, reportId, updateDto, note);
    }
}
