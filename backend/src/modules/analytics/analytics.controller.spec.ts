import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ExportFormat } from './dto/analytics-query.dto';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;

  const mockAnalyticsService = {
    getUserMetrics: jest.fn(),
    getPetRegistrationTrends: jest.fn(),
    getPetHealthTrends: jest.fn(),
    getVaccinationCompliance: jest.fn(),
    getAppointmentStatistics: jest.fn(),
    getSystemUsageAnalytics: jest.fn(),
    getGeographicDistribution: jest.fn(),
    generateCustomReport: jest.fn(),
    getDashboardOverview: jest.fn(),
    exportReport: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: mockAnalyticsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    jest.clearAllMocks();
  });

  it('delegates custom report requests to the analytics service', async () => {
    mockAnalyticsService.generateCustomReport.mockResolvedValue({
      reportName: 'analytics-report',
    });

    const result = await controller.getCustomReport({
      metrics: 'pet_health,system_usage',
    });

    expect(mockAnalyticsService.generateCustomReport).toHaveBeenCalledWith({
      metrics: 'pet_health,system_usage',
    });
    expect(result.reportName).toBe('analytics-report');
  });

  it('returns csv export responses with the right headers', async () => {
    mockAnalyticsService.exportReport.mockResolvedValue({
      contentType: 'text/csv',
      filename: 'analytics-report-123.csv',
      body: 'section,metric,value',
    });

    const res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };

    await controller.exportReport({ format: ExportFormat.CSV }, res as any);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename=analytics-report-123.csv',
    );
    expect(res.send).toHaveBeenCalledWith('section,metric,value');
  });
});
