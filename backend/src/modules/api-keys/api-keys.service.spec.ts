import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { ApiKey } from './entities/api-key.entity';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let repo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock; find: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 'key-1', ...data })),
      findOne: jest.fn(),
      find: jest.fn(),
    };
    cache = {
      get: jest.fn().mockResolvedValue(0),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        { provide: getRepositoryToken(ApiKey), useValue: repo },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get<ApiKeysService>(ApiKeysService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createKey', () => {
    it('creates a key with a hashed value and returns the plaintext once', async () => {
      const { apiKey, plaintextKey } = await service.createKey({
        userId: 'user-1',
        label: 'My Key',
      });

      expect(plaintextKey).toMatch(/^pk_live_/);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(apiKey.keyHash).not.toEqual(plaintextKey);
    });
  });

  describe('validateAndConsume', () => {
    it('throws BadRequestException when no key is provided', async () => {
      await expect(service.validateAndConsume('')).rejects.toThrow();
    });

    it('throws ForbiddenException for an unknown key', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.validateAndConsume('pk_live_unknown')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException for a revoked key', async () => {
      repo.findOne.mockResolvedValue({
        id: 'key-1',
        revokedAt: new Date(),
        rateLimitWindowSec: 60,
        rateLimitMax: 60,
        usageCount: '0',
      });
      await expect(service.validateAndConsume('pk_live_revoked')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException for an expired key', async () => {
      repo.findOne.mockResolvedValue({
        id: 'key-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        rateLimitWindowSec: 60,
        rateLimitMax: 60,
        usageCount: '0',
      });
      await expect(service.validateAndConsume('pk_live_expired')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('increments usage count and returns the key on success', async () => {
      const stored = {
        id: 'key-1',
        revokedAt: null,
        expiresAt: null,
        rateLimitWindowSec: 60,
        rateLimitMax: 60,
        usageCount: '3',
      };
      repo.findOne.mockResolvedValue(stored);
      repo.save.mockImplementation((data) => Promise.resolve(data));

      const result = await service.validateAndConsume('pk_live_valid');
      expect(result.apiKey.usageCount).toBe('4');
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws ForbiddenException once the rate limit is exceeded', async () => {
      repo.findOne.mockResolvedValue({
        id: 'key-1',
        revokedAt: null,
        expiresAt: null,
        rateLimitWindowSec: 60,
        rateLimitMax: 5,
        usageCount: '0',
      });
      cache.get.mockResolvedValue(5);

      await expect(service.validateAndConsume('pk_live_throttled')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('revokeKey', () => {
    it('throws NotFoundException for a missing key', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.revokeKey('missing-id', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when revoking another user\'s key', async () => {
      repo.findOne.mockResolvedValue({ id: 'key-1', userId: 'owner-1' });
      await expect(service.revokeKey('key-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('revokes a key owned by the requesting user', async () => {
      repo.findOne.mockResolvedValue({ id: 'key-1', userId: 'user-1', revokedAt: null });
      repo.save.mockImplementation((data) => Promise.resolve(data));

      const result = await service.revokeKey('key-1', 'user-1');
      expect(result.revokedAt).toBeInstanceOf(Date);
      expect(result.revokedByUserId).toBe('user-1');
    });
  });
});
