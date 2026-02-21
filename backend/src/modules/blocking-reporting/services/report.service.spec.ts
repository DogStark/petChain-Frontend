import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ReportService } from './report.service';
import { Report } from '../entities/report.entity';
import { ReportNote } from '../entities/report-note.entity';
import { AuditService } from '../../audit/audit.service';
import { ReportCategory } from '../enums/report-category.enum';
import { ReportStatus } from '../enums/report-status.enum';

describe('ReportService', () => {
    let service: ReportService;
    let reportRepository: Repository<Report>;
    let reportNoteRepository: Repository<ReportNote>;
    let auditService: AuditService;

    const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(),
    };

    const mockReportRepository = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const mockReportNoteRepository = {
        create: jest.fn(),
        save: jest.fn(),
    };

    const mockAuditService = {
        log: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReportService,
                {
                    provide: getRepositoryToken(Report),
                    useValue: mockReportRepository,
                },
                {
                    provide: getRepositoryToken(ReportNote),
                    useValue: mockReportNoteRepository,
                },
                {
                    provide: AuditService,
                    useValue: mockAuditService,
                },
            ],
        }).compile();

        service = module.get<ReportService>(ReportService);
        reportRepository = module.get<Repository<Report>>(getRepositoryToken(Report));
        reportNoteRepository = module.get<Repository<ReportNote>>(
            getRepositoryToken(ReportNote),
        );
        auditService = module.get<AuditService>(AuditService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createReport', () => {
        it('should create a new report', async () => {
            const reporterId = 'reporter-1';
            const dto = {
                reportedUserId: 'reported-1',
                category: ReportCategory.SPAM,
                description: 'spamming',
            };
            const newReport = { id: 'report-1', ...dto };

            mockReportRepository.create.mockReturnValue(newReport);
            mockReportRepository.save.mockResolvedValue(newReport);

            const result = await service.createReport(reporterId, dto);

            expect(result).toEqual(newReport);
            expect(mockReportRepository.create).toHaveBeenCalled();
            expect(mockReportRepository.save).toHaveBeenCalledWith(newReport);
            expect(mockAuditService.log).toHaveBeenCalled();
        });
    });

    describe('getReports', () => {
        it('should return paginated reports with filtered criteria', async () => {
            mockQueryBuilder.getManyAndCount.mockResolvedValue([[{ id: 'r1' }], 1]);

            const filterDto = { status: ReportStatus.PENDING, category: ReportCategory.SPAM };
            const result = await service.getReports(filterDto, 10, 1);

            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('report.status = :status', { status: ReportStatus.PENDING });
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('report.category = :category', { category: ReportCategory.SPAM });
        });
    });

    describe('getReportById', () => {
        it('should return a report', async () => {
            mockReportRepository.findOne.mockResolvedValue({ id: 'r1' });
            const result = await service.getReportById('r1');
            expect(result.id).toEqual('r1');
        });

        it('should throw NotFoundException if report not found', async () => {
            mockReportRepository.findOne.mockResolvedValue(null);
            await expect(service.getReportById('r1')).rejects.toThrow(NotFoundException);
        });
    });

    describe('updateReportStatus', () => {
        it('should update status and add a note', async () => {
            const report = { id: 'r1', status: ReportStatus.PENDING };
            const updatedReport = { ...report, status: ReportStatus.RESOLVED };

            jest.spyOn(service, 'getReportById').mockResolvedValue(report as any);
            mockReportRepository.save.mockResolvedValue(updatedReport);
            mockReportNoteRepository.create.mockReturnValue({ id: 'note-1' });

            const result = await service.updateReportStatus('admin-1', 'r1', { status: ReportStatus.RESOLVED }, 'Good');

            expect(result.status).toBe(ReportStatus.RESOLVED);
            expect(mockReportRepository.save).toHaveBeenCalled();
            expect(mockReportNoteRepository.create).toHaveBeenCalled();
            expect(mockReportNoteRepository.save).toHaveBeenCalled();
            expect(mockAuditService.log).toHaveBeenCalled();
        });
    });

    describe('getReportStatistics', () => {
        it('should return report statistics', async () => {
            mockQueryBuilder.getRawMany
                .mockResolvedValueOnce([{ status: 'pending', count: '5' }])
                .mockResolvedValueOnce([{ category: 'spam', count: '5' }]);

            const result = await service.getReportStatistics({});

            expect(result.total).toBe(5);
            expect(result.byStatus).toEqual([{ status: 'pending', count: '5' }]);
            expect(result.byCategory).toEqual([{ category: 'spam', count: '5' }]);
        });
    });
});
