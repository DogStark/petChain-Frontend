import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditLog, AuditAction } from './entities/audit-log.entity';

const mockLog: AuditLog = {
  id: 'log-1',
  userId: 'user-1',
  entityType: 'Pet',
  entityId: 'pet-1',
  action: AuditAction.READ,
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
  timestamp: new Date('2024-01-01T00:00:00Z'),
} as AuditLog;

const mockRepo = {
  create: jest.fn().mockReturnValue(mockLog),
  save: jest.fn().mockResolvedValue(mockLog),
  find: jest.fn().mockResolvedValue([mockLog]),
  findAndCount: jest.fn().mockResolvedValue([[mockLog], 1]),
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useValue: mockRepo },
      ],
    }).compile();
    service = module.get(AuditService);
    jest.clearAllMocks();
    mockRepo.create.mockReturnValue(mockLog);
    mockRepo.save.mockResolvedValue(mockLog);
    mockRepo.find.mockResolvedValue([mockLog]);
    mockRepo.findAndCount.mockResolvedValue([[mockLog], 1]);
  });

  it('logs an audit entry', async () => {
    const result = await service.log('user-1', 'Pet', 'pet-1', AuditAction.READ, '127.0.0.1');
    expect(mockRepo.create).toHaveBeenCalled();
    expect(mockRepo.save).toHaveBeenCalled();
    expect(result).toEqual(mockLog);
  });

  it('findAll returns paginated results', async () => {
    const result = await service.findAll({ page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });

  it('findAll filters by userId', async () => {
    await service.findAll({ userId: 'user-1' });
    expect(mockRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1' }) }),
    );
  });

  it('findAll filters by action', async () => {
    await service.findAll({ action: AuditAction.DELETE });
    expect(mockRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ action: AuditAction.DELETE }) }),
    );
  });

  it('findAll filters by date range', async () => {
    await service.findAll({ dateFrom: '2024-01-01', dateTo: '2024-12-31' });
    expect(mockRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ timestamp: expect.anything() }) }),
    );
  });

  it('findByEntity returns logs for entity', async () => {
    const result = await service.findByEntity('Pet', 'pet-1');
    expect(mockRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { entityType: 'Pet', entityId: 'pet-1' } }),
    );
    expect(result).toHaveLength(1);
  });

  it('exportCsv returns a Buffer with CSV content', async () => {
    const csv = await service.exportCsv({});
    expect(csv).toBeInstanceOf(Buffer);
    const content = csv.toString();
    expect(content).toContain('id,userId,entityType');
    expect(content).toContain('log-1');
  });
});
