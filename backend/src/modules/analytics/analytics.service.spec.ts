import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { User } from '../users/entities/user.entity';
import { Pet } from '../pets/entities/pet.entity';
import { Vaccination } from '../vaccinations/entities/vaccination.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import {
  MedicalRecord,
  RecordType,
} from '../medical-records/entities/medical-record.entity';
import {
  ActivityType,
  UserActivityLog,
} from '../users/entities/user-activity-log.entity';
import { AnalyticsGroupBy, ExportFormat } from './dto/analytics-query.dto';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const mockUserRepository = {
    count: jest.fn(),
    find: jest.fn(),
  };

  const mockPetRepository = {
    count: jest.fn(),
    find: jest.fn(),
  };

  const mockVaccinationRepository = {
    find: jest.fn(),
  };

  const mockAppointmentRepository = {
    count: jest.fn(),
    find: jest.fn(),
  };

  const mockMedicalRecordRepository = {
    find: jest.fn(),
  };

  const mockUserActivityLogRepository = {
    find: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: getRepositoryToken(Pet), useValue: mockPetRepository },
        {
          provide: getRepositoryToken(Vaccination),
          useValue: mockVaccinationRepository,
        },
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockAppointmentRepository,
        },
        {
          provide: getRepositoryToken(MedicalRecord),
          useValue: mockMedicalRecordRepository,
        },
        {
          provide: getRepositoryToken(UserActivityLog),
          useValue: mockUserActivityLogRepository,
        },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    jest.clearAllMocks();
  });

  it('builds a custom report with health, vaccination, and usage sections', async () => {
    mockCacheManager.get.mockResolvedValue(undefined);
    mockMedicalRecordRepository.find.mockResolvedValue([
      {
        petId: 'pet-1',
        visitDate: new Date('2026-03-01T00:00:00.000Z'),
        diagnosis: 'Healthy',
        verified: true,
        recordType: RecordType.CHECKUP,
      },
      {
        petId: 'pet-1',
        visitDate: new Date('2026-03-03T00:00:00.000Z'),
        diagnosis: 'Sprain',
        verified: false,
        recordType: RecordType.EMERGENCY,
      },
    ]);
    mockVaccinationRepository.find.mockResolvedValue([
      {
        vaccineName: 'Rabies',
        administeredDate: new Date('2026-03-02T00:00:00.000Z'),
        nextDueDate: new Date('2026-05-10T00:00:00.000Z'),
      },
      {
        vaccineName: 'DHPP',
        administeredDate: new Date('2026-03-04T00:00:00.000Z'),
        nextDueDate: new Date('2026-03-10T00:00:00.000Z'),
      },
    ]);
    mockUserActivityLogRepository.find.mockResolvedValue([
      {
        userId: 'user-1',
        activityType: ActivityType.LOGIN,
        isSuspicious: false,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
      {
        userId: 'user-2',
        activityType: ActivityType.DATA_EXPORT,
        isSuspicious: true,
        createdAt: new Date('2026-03-02T00:00:00.000Z'),
      },
    ]);
    mockAppointmentRepository.count.mockResolvedValue(4);

    const report = await service.generateCustomReport({
      metrics: 'pet_health,vaccination_compliance,system_usage',
      groupBy: AnalyticsGroupBy.DAY,
      reportName: 'ops-health',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });

    expect(report.reportName).toBe('ops-health');
    expect(report.sections).toHaveProperty('petHealth');
    expect(report.sections).toHaveProperty('vaccinationCompliance');
    expect(report.sections).toHaveProperty('systemUsage');
    expect((report.sections as any).petHealth.summary.totalRecords).toBe(2);
    expect((report.sections as any).systemUsage.summary.activeUsers).toBe(2);
    expect(mockCacheManager.set).toHaveBeenCalled();
  });

  it('returns cached analytics results when available', async () => {
    mockCacheManager.get.mockResolvedValue({
      summary: { totalEvents: 99 },
      visualization: { trend: [] },
    });

    const result = await service.getSystemUsageAnalytics({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });

    expect(result.summary.totalEvents).toBe(99);
    expect(mockUserActivityLogRepository.find).not.toHaveBeenCalled();
  });

  it('exports csv rows for the requested report', async () => {
    mockCacheManager.get.mockResolvedValue(undefined);
    mockMedicalRecordRepository.find.mockResolvedValue([
      {
        petId: 'pet-1',
        visitDate: new Date('2026-03-01T00:00:00.000Z'),
        diagnosis: 'Healthy',
        verified: true,
        recordType: RecordType.CHECKUP,
      },
    ]);
    mockVaccinationRepository.find.mockResolvedValue([]);
    mockUserActivityLogRepository.find.mockResolvedValue([]);
    mockAppointmentRepository.count.mockResolvedValue(0);

    const result = await service.exportReport({
      metrics: 'pet_health',
      format: ExportFormat.CSV,
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });

    expect(result.contentType).toBe('text/csv');
    expect(result.filename).toMatch(/analytics-report-\d+\.csv$/);
    expect(result.body).toContain('"section","metric","value"');
    expect(result.body).toContain('"petHealth","totalRecords",1');
  });
});
