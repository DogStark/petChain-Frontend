import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

class TooManyRequestsException extends HttpException {
  constructor(message = 'Too Many Requests') {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
import { GdprService } from './gdpr.service';
import { UserConsent } from './entities/user-consent.entity';
import { DataDeletionRequest, DeletionStatus } from './entities/data-deletion-request.entity';
import { GdprRequest, GdprRequestStatus, GdprRequestType } from './entities/gdpr-request.entity';
import { StorageService } from '../storage/storage.service';

const mockConsentRepo = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
const mockDeletionRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
const mockGdprRequestRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
const mockDataSource = { query: jest.fn(), transaction: jest.fn() };
const mockStorageService = { upload: jest.fn().mockResolvedValue({ url: 'https://storage/export.json' }) };
const mockGdprQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

describe('GdprService', () => {
  let service: GdprService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdprService,
        { provide: getRepositoryToken(UserConsent), useValue: mockConsentRepo },
        { provide: getRepositoryToken(DataDeletionRequest), useValue: mockDeletionRepo },
        { provide: getRepositoryToken(GdprRequest), useValue: mockGdprRequestRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: StorageService, useValue: mockStorageService },
        { provide: getQueueToken('gdpr'), useValue: mockGdprQueue },
      ],
    }).compile();

    service = module.get<GdprService>(GdprService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── Export ────────────────────────────────────────────────────────────────

  describe('requestExport', () => {
    it('creates a PENDING GdprRequest and enqueues a job', async () => {
      mockGdprRequestRepo.findOne.mockResolvedValue(null);
      mockGdprRequestRepo.create.mockReturnValue({
        id: 'req-1', userId: 'u1', type: GdprRequestType.EXPORT, status: GdprRequestStatus.PENDING,
      });
      mockGdprRequestRepo.save.mockImplementation((x) => Promise.resolve(x));

      const result = await service.requestExport('u1');

      expect(mockGdprRequestRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', type: GdprRequestType.EXPORT }),
      );
      expect(mockGdprQueue.add).toHaveBeenCalledWith(
        'gdpr-job',
        expect.objectContaining({ userId: 'u1', type: GdprRequestType.EXPORT }),
      );
      expect(result.status).toBe(GdprRequestStatus.PENDING);
    });

    it('throws TooManyRequestsException when a recent export already exists', async () => {
      mockGdprRequestRepo.findOne.mockResolvedValue({
        id: 'old-req', type: GdprRequestType.EXPORT, requestedAt: new Date(),
      });

      await expect(service.requestExport('u1')).rejects.toThrow(TooManyRequestsException);
    });
  });

  // ── Erasure ───────────────────────────────────────────────────────────────

  describe('requestErasure', () => {
    it('throws UnauthorizedException on wrong password', async () => {
      mockGdprRequestRepo.findOne.mockResolvedValue(null);
      mockDataSource.query.mockResolvedValueOnce([{ password: '$2b$12$hashedpassword' }]);

      jest.spyOn(require('../../auth/utils/password.util'), 'PasswordUtil', 'get').mockReturnValue({
        comparePassword: jest.fn().mockResolvedValue(false),
      });

      await expect(service.requestErasure('u1', 'wrongpass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockGdprRequestRepo.findOne.mockResolvedValue(null);
      mockDataSource.query.mockResolvedValueOnce([]);

      await expect(service.requestErasure('u1', 'somepass')).rejects.toThrow(NotFoundException);
    });

    it('throws TooManyRequestsException when a recent erasure request exists', async () => {
      mockGdprRequestRepo.findOne.mockResolvedValue({
        id: 'old-req', type: GdprRequestType.ERASURE, requestedAt: new Date(),
      });

      await expect(service.requestErasure('u1', 'pass')).rejects.toThrow(TooManyRequestsException);
    });
  });

  // ── Rate limit ────────────────────────────────────────────────────────────

  describe('rate limiting (enforceRateLimit)', () => {
    it('allows a request if none exists in last 24h', async () => {
      mockGdprRequestRepo.findOne.mockResolvedValue(null);
      mockGdprRequestRepo.create.mockReturnValue({
        id: 'r1', userId: 'u1', type: GdprRequestType.EXPORT, status: GdprRequestStatus.PENDING,
      });
      mockGdprRequestRepo.save.mockImplementation((x) => Promise.resolve(x));

      await expect(service.requestExport('u1')).resolves.toBeDefined();
    });

    it('blocks if a request was made within 24h', async () => {
      mockGdprRequestRepo.findOne.mockResolvedValue({ requestedAt: new Date() });

      await expect(service.requestExport('u1')).rejects.toThrow(TooManyRequestsException);
    });
  });

  // ── getGdprRequest ────────────────────────────────────────────────────────

  describe('getGdprRequest', () => {
    it('returns the request when found', async () => {
      const req = { id: 'r1', userId: 'u1' };
      mockGdprRequestRepo.findOne.mockResolvedValue(req);

      const result = await service.getGdprRequest('r1', 'u1');
      expect(result).toEqual(req);
    });

    it('throws NotFoundException when not found', async () => {
      mockGdprRequestRepo.findOne.mockResolvedValue(null);

      await expect(service.getGdprRequest('bad', 'u1')).rejects.toThrow(NotFoundException);
    });
  });
});
