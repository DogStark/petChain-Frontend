import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ThreatDetectionService } from '../services/threat-detection.service';
import { SecurityEvent } from '../entities/security-event.entity';

describe('ThreatDetectionService', () => {
  let service: ThreatDetectionService;
  let securityEventRepository: Repository<SecurityEvent>;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThreatDetectionService,
        {
          provide: getRepositoryToken(SecurityEvent),
          useValue: {
            create: jest.fn().mockReturnValue({}),
            save: jest.fn().mockResolvedValue({ id: 'test-event-id' }),
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ThreatDetectionService>(ThreatDetectionService);
    securityEventRepository = module.get<Repository<SecurityEvent>>(
      getRepositoryToken(SecurityEvent),
    );
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyzeRequest', () => {
    it('should detect SQL injection', async () => {
      const mockRequest = {
        url: '/api/users',
        method: 'POST',
        body: { username: "admin'; DROP TABLE users--" },
        query: {},
        params: {},
        ip: '192.168.1.100',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
        user: undefined,
      };

      const result = await service.analyzeRequest(mockRequest);

      expect(result.isThreat).toBe(true);
      expect(result.threatScore).toBeGreaterThan(0);
      expect(result.type).toBe('SQL_INJECTION_ATTEMPT');
    });

    it('should detect XSS attempt', async () => {
      const mockRequest = {
        url: '/api/search',
        method: 'GET',
        body: {},
        query: { q: '<script>alert("xss")</script>' },
        params: {},
        ip: '192.168.1.101',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
        user: undefined,
      };

      const result = await service.analyzeRequest(mockRequest);

      expect(result.isThreat).toBe(true);
      expect(result.type).toBe('XSS_ATTEMPT');
    });

    it('should not detect threat in normal request', async () => {
      const mockRequest = {
        url: '/api/users',
        method: 'GET',
        body: {},
        query: { page: '1', limit: '10' },
        params: {},
        ip: '192.168.1.102',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
        user: { id: 'user123' },
      };

      const result = await service.analyzeRequest(mockRequest);

      expect(result.isThreat).toBe(false);
      expect(result.threatScore).toBe(0);
    });
  });

  describe('getSecurityEvents', () => {
    it('should return filtered security events', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      securityEventRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      const filters = {
        ipAddress: '192.168.1.100',
        type: 'SQL_INJECTION_ATTEMPT' as any,
        limit: 10,
      };

      const result = await service.getSecurityEvents(filters);

      expect(result).toEqual([]);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('event.ipAddress = :ip', { ip: '192.168.1.100' });
    });
  });
});