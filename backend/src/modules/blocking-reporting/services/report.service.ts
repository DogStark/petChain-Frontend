import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from '../entities/report.entity';
import { ReportNote } from '../entities/report-note.entity';
import { CreateReportDto } from '../dto/create-report.dto';
import { ReportFilterDto } from '../dto/report-filter.dto';
import { UpdateReportStatusDto } from '../dto/update-report-status.dto';
import { StatisticsQueryDto } from '../dto/statistics-query.dto';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';

@Injectable()
export class ReportService {
    constructor(
        @InjectRepository(Report)
        private readonly reportRepository: Repository<Report>,
        @InjectRepository(ReportNote)
        private readonly reportNoteRepository: Repository<ReportNote>,
        private readonly auditService: AuditService,
    ) { }

    async createReport(
        reporterId: string,
        createReportDto: CreateReportDto,
    ): Promise<Report> {
        const report = this.reportRepository.create({
            reporter: { id: reporterId },
            reportedUser: { id: createReportDto.reportedUserId },
            category: createReportDto.category,
            description: createReportDto.description,
        });

        const savedReport = await this.reportRepository.save(report);

        await this.auditService.log(
            reporterId,
            'Report',
            savedReport.id,
            AuditAction.CREATE,
        );

        return savedReport;
    }

    async getReports(
        filterDto: ReportFilterDto,
        limit: number = 10,
        page: number = 1,
    ): Promise<{ data: Report[]; total: number; page: number; limit: number }> {
        const query = this.reportRepository
            .createQueryBuilder('report')
            .leftJoinAndSelect('report.reporter', 'reporter')
            .leftJoinAndSelect('report.reportedUser', 'reportedUser');

        if (filterDto.status) {
            query.andWhere('report.status = :status', { status: filterDto.status });
        }

        if (filterDto.category) {
            query.andWhere('report.category = :category', {
                category: filterDto.category,
            });
        }

        if (filterDto.startDate) {
            query.andWhere('report.createdAt >= :startDate', {
                startDate: filterDto.startDate,
            });
        }

        if (filterDto.endDate) {
            query.andWhere('report.createdAt <= :endDate', {
                endDate: filterDto.endDate,
            });
        }

        query.skip((page - 1) * limit).take(limit);
        query.orderBy('report.createdAt', 'DESC');

        const [data, total] = await query.getManyAndCount();

        // Clean sensitive user info
        data.forEach(report => {
            if (report.reporter) {
                delete report.reporter.password;
                delete report.reporter.passwordResetToken;
                delete report.reporter.emailVerificationToken;
            }
            if (report.reportedUser) {
                delete report.reportedUser.password;
                delete report.reportedUser.passwordResetToken;
                delete report.reportedUser.emailVerificationToken;
            }
        });

        return {
            data,
            total,
            page,
            limit,
        };
    }

    async getReportById(reportId: string): Promise<Report> {
        const report = await this.reportRepository.findOne({
            where: { id: reportId },
            relations: ['reporter', 'reportedUser'],
        });

        if (!report) {
            throw new NotFoundException('Report not found');
        }

        // clean up password
        if (report.reporter) {
            delete report.reporter.password;
            delete report.reporter.passwordResetToken;
            delete report.reporter.emailVerificationToken;
        }
        if (report.reportedUser) {
            delete report.reportedUser.password;
            delete report.reportedUser.passwordResetToken;
            delete report.reportedUser.emailVerificationToken;
        }

        return report;
    }

    async updateReportStatus(
        adminId: string,
        reportId: string,
        updateDto: UpdateReportStatusDto,
        note?: string,
    ): Promise<Report> {
        const report = await this.getReportById(reportId);

        report.status = updateDto.status;
        const updatedReport = await this.reportRepository.save(report);

        if (note) {
            const reportNote = this.reportNoteRepository.create({
                report: updatedReport,
                admin: { id: adminId },
                note,
            });
            await this.reportNoteRepository.save(reportNote);
        }

        await this.auditService.log(
            adminId,
            'ReportStatusUpdate',
            updatedReport.id,
            AuditAction.UPDATE,
        );

        return updatedReport;
    }

    async getReportStatistics(queryDto: StatisticsQueryDto): Promise<any> {
        const query = this.reportRepository.createQueryBuilder('report');

        if (queryDto.startDate) {
            query.andWhere('report.createdAt >= :startDate', {
                startDate: queryDto.startDate,
            });
        }

        if (queryDto.endDate) {
            query.andWhere('report.createdAt <= :endDate', {
                endDate: queryDto.endDate,
            });
        }

        if (queryDto.userId) {
            query.andWhere('report.reported_user_id = :userId', {
                userId: queryDto.userId,
            });
        }

        const byStatus = await query
            .select('report.status, COUNT(report.id) as count')
            .groupBy('report.status')
            .getRawMany();

        const byCategory = await query
            .select('report.category, COUNT(report.id) as count')
            .groupBy('report.category')
            .getRawMany();

        const totalReports = byStatus.reduce((acc, curr) => acc + parseInt(curr.count, 10), 0);

        return {
            total: totalReports,
            byStatus,
            byCategory,
        };
    }
}
