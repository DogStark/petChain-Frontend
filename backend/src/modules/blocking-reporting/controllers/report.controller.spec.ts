import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ReportController } from './report.controller';
import { ReportService } from '../services/report.service';
import { ReportStatus } from '../enums/report-status.enum';
import { ReportCategory } from '../enums/report-category.enum';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';

describe('ReportController', () => {
    let controller: ReportController;
    let reportService: ReportService;

    const mockReportService = {
        createReport: jest.fn(),
        getReports: jest.fn(),
        getReportStatistics: jest.fn(),
        getReportById: jest.fn(),
        updateReportStatus: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ReportController],
            providers: [
                {
                    provide: ReportService,
                    useValue: mockReportService,
                },
                {
                    provide: Reflector,
                    useValue: {
                        getAllAndOverride: jest.fn(),
                    },
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<ReportController>(ReportController);
        reportService = module.get<ReportService>(ReportService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createReport', () => {
        it('should create a report', async () => {
            const dto = { reportedUserId: 'user-2', category: ReportCategory.SPAM };
            mockReportService.createReport.mockResolvedValue({ id: 'report-1' });

            const result = await controller.createReport('user-1', dto);
            expect(result).toEqual({ id: 'report-1' });
            expect(mockReportService.createReport).toHaveBeenCalledWith('user-1', dto);
        });
    });

    describe('getReports', () => {
        it('should get paginated reports', async () => {
            mockReportService.getReports.mockResolvedValue({ data: [], total: 0 });
            const filter = { status: ReportStatus.PENDING };

            const result = await controller.getReports(filter, 10, 1);
            expect(result).toEqual({ data: [], total: 0 });
            expect(mockReportService.getReports).toHaveBeenCalledWith(filter, 10, 1);
        });
    });

    describe('getReportStatistics', () => {
        it('should return report statistics', async () => {
            mockReportService.getReportStatistics.mockResolvedValue({ total: 1 });

            const result = await controller.getReportStatistics({});
            expect(result).toEqual({ total: 1 });
            expect(mockReportService.getReportStatistics).toHaveBeenCalledWith({});
        });
    });

    describe('getReportById', () => {
        it('should return a report', async () => {
            mockReportService.getReportById.mockResolvedValue({ id: 'report-1' });

            const result = await controller.getReportById('report-1');
            expect(result).toEqual({ id: 'report-1' });
            expect(mockReportService.getReportById).toHaveBeenCalledWith('report-1');
        });
    });

    describe('updateReportStatus', () => {
        it('should update status', async () => {
            mockReportService.updateReportStatus.mockResolvedValue({ status: ReportStatus.RESOLVED });

            const dto = { status: ReportStatus.RESOLVED };
            const note = 'Review completed';

            const result = await controller.updateReportStatus('admin-1', 'report-1', dto, note);

            expect(result).toEqual({ status: ReportStatus.RESOLVED });
            expect(mockReportService.updateReportStatus).toHaveBeenCalledWith('admin-1', 'report-1', dto, note);
        });
    });
});
