import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { ApiKey } from './entities/api-key.entity';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let apiKeyRepository: Repository<ApiKey>;
  let cacheManager: any;

  const mockApiKeyRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        {
          provide: getRepositoryToken(ApiKey),
          useValue: mockApiKeyRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<ApiKeysService>(ApiKeysService);
    apiKeyRepository = module.get<Repository<ApiKey>>(
      getRepositoryToken(ApiKey),
    );
    cacheManager = module.get(CACHE_MANAGER);

    jest.clearAllMocks();
  });

  describe('createKey', () => {
    it('should create a new API key with hash', async () => {
      const userId = 'user-123';
      const label = 'My API Key';
      const mockApiKey: Partial<ApiKey> = {
        id: 'key-123',
        userId,
        label,
        prefix: 'pk_live',
        lastFour: expect.any(String),
        keyHash: expect.any(String),
        rateLimitWindowSec: 60,
        rateLimitMax: 60,
        expiresAt: null,
        usageCount: '0',
        lastUsedAt: null,
      };

      mockApiKeyRepository.create.mockReturnValue(mockApiKey);
      mockApiKeyRepository.save.mockResolvedValue(mockApiKey);

      const result = await service.createKey({
        userId,
        label,
      });

      expect(result.apiKey).toEqual(mockApiKey);
      expect(result.plaintextKey).toMatch(/^pk_live_/);
      expect(mockApiKeyRepository.create).toHaveBeenCalled();
      expect(mockApiKeyRepository.save).toHaveBeenCalled();
    });

    it('should use provided rate limit settings', async () => {
      const userId = 'user-123';
      mockApiKeyRepository.create.mockReturnValue({
        rateLimitWindowSec: 120,
        rateLimitMax: 100,
      });
      mockApiKeyRepository.save.mockResolvedValue({
        rateLimitWindowSec: 120,
        rateLimitMax: 100,
      });

      await service.createKey({
        userId,
        label: 'Test',
        rateLimitWindowSec: 120,
        rateLimitMax: 100,
      });

      const call = mockApiKeyRepository.create.mock.calls[0][0];
      expect(call.rateLimitWindowSec).toBe(120);
      expect(call.rateLimitMax).toBe(100);
    });

    it('should hash the API key', async () => {
      mockApiKeyRepository.create.mockReturnValue({ id: 'key-123' });
      mockApiKeyRepository.save.mockResolvedValue({ id: 'key-123' });

      await service.createKey({ userId: 'user-123', label: 'Test' });

      const call = mockApiKeyRepository.create.mock.calls[0][0];
      expect(call.keyHash).toBeTruthy();
      expect(call.keyHash).toHaveLength(64); // scrypt hex hash
    });
  });

  describe('revokeKey', () => {
    it('should revoke a key if user owns it', async () => {
      const userId = 'user-123';
      const keyId = 'key-123';
      const mockKey: Partial<ApiKey> = {
        id: keyId,
        userId,
        revokedAt: null,
      };

      mockApiKeyRepository.findOne.mockResolvedValue(mockKey);
      mockApiKeyRepository.save.mockResolvedValue({
        ...mockKey,
        revokedAt: expect.any(Date),
        revokedByUserId: userId,
      });

      const result = await service.revokeKey(keyId, userId);

      expect(result.revokedAt).toBeTruthy();
      expect(result.revokedByUserId).toBe(userId);
      expect(mockApiKeyRepository.save).toHaveBeenCalled();
    });

    it('should throw if key not found', async () => {
      mockApiKeyRepository.findOne.mockResolvedValue(null);

      await expect(
        service.revokeKey('nonexistent', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if user does not own the key', async () => {
      mockApiKeyRepository.findOne.mockResolvedValue({
        id: 'key-123',
        userId: 'other-user',
      });

      await expect(
        service.revokeKey('key-123', 'user-123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return key if already revoked', async () => {
      const revokedDate = new Date();
      mockApiKeyRepository.findOne.mockResolvedValue({
        id: 'key-123',
        userId: 'user-123',
        revokedAt: revokedDate,
      });

      const result = await service.revokeKey('key-123', 'user-123');

      expect(result.revokedAt).toBe(revokedDate);
      expect(mockApiKeyRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('adminRevokeKey', () => {
    it('should allow admin to revoke any key', async () => {
      const adminId = 'admin-123';
      mockApiKeyRepository.findOne.mockResolvedValue({
        id: 'key-123',
        userId: 'other-user',
        revokedAt: null,
      });
      mockApiKeyRepository.save.mockResolvedValue({
        id: 'key-123',
        revokedAt: expect.any(Date),
        revokedByUserId: adminId,
      });

      const result = await service.adminRevokeKey('key-123', adminId);

      expect(result.revokedAt).toBeTruthy();
      expect(result.revokedByUserId).toBe(adminId);
    });

    it('should throw if key not found', async () => {
      mockApiKeyRepository.findOne.mockResolvedValue(null);

      await expect(
        service.adminRevokeKey('nonexistent', 'admin-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listMyKeys', () => {
    it('should return all keys for a user', async () => {
      const userId = 'user-123';
      const mockKeys: Partial<ApiKey>[] = [
        { id: 'key-1', label: 'Key 1' },
        { id: 'key-2', label: 'Key 2' },
      ];

      mockApiKeyRepository.find.mockResolvedValue(mockKeys);

      const result = await service.listMyKeys(userId);

      expect(result).toEqual(mockKeys);
      expect(mockApiKeyRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('validateAndConsume', () => {
    it('should validate and consume a valid key', async () => {
      const plaintextKey = 'pk_live_abc123xyz';
      const mockKey: Partial<ApiKey> = {
        id: 'key-123',
        usageCount: '5',
        revokedAt: null,
        expiresAt: null,
        rateLimitWindowSec: 60,
        rateLimitMax: 60,
      };

      mockApiKeyRepository.findOne.mockResolvedValue(mockKey);
      mockCacheManager.get.mockResolvedValue(50);
      mockApiKeyRepository.save.mockResolvedValue({
        ...mockKey,
        usageCount: '6',
        lastUsedAt: expect.any(Date),
      });

      const result = await service.validateAndConsume(plaintextKey);

      expect(result.apiKey.usageCount).toBe('6');
      expect(result.apiKey.lastUsedAt).toBeTruthy();
      expect(mockApiKeyRepository.save).toHaveBeenCalled();
    });

    it('should throw if key is empty', async () => {
      await expect(service.validateAndConsume('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if key not found', async () => {
      mockApiKeyRepository.findOne.mockResolvedValue(null);

      await expect(
        service.validateAndConsume('pk_live_invalid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if key is revoked', async () => {
      mockApiKeyRepository.findOne.mockResolvedValue({
        id: 'key-123',
        revokedAt: new Date(),
      });

      await expect(
        service.validateAndConsume('pk_live_revoked'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if key is expired', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      mockApiKeyRepository.findOne.mockResolvedValue({
        id: 'key-123',
        revokedAt: null,
        expiresAt: pastDate,
      });

      await expect(
        service.validateAndConsume('pk_live_expired'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should enforce rate limit', async () => {
      const mockKey: Partial<ApiKey> = {
        id: 'key-123',
        revokedAt: null,
        expiresAt: null,
        rateLimitWindowSec: 60,
        rateLimitMax: 10,
      };

      mockApiKeyRepository.findOne.mockResolvedValue(mockKey);
      mockCacheManager.get.mockResolvedValue(10); // at limit

      await expect(
        service.validateAndConsume('pk_live_limited'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
