import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { User } from '../users/entities/user.entity';
import { CanActivate } from '@nestjs/common';

const mockGuard: CanActivate = {
  canActivate: () => true,
};

describe('ApiKeysController', () => {
  let controller: ApiKeysController;
  let service: ApiKeysService;

  const mockApiKeysService = {
    listMyKeys: jest.fn(),
    createKey: jest.fn(),
    revokeKey: jest.fn(),
    adminRevokeKey: jest.fn(),
  };

  const mockUser: Partial<User> = {
    id: 'user-123',
    email: 'test@example.com',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeysController],
      providers: [
        {
          provide: ApiKeysService,
          useValue: mockApiKeysService,
        },
      ],
    })
      .overrideGuard('JWT_AUTH')
      .useValue(mockGuard)
      .overrideGuard('ROLES')
      .useValue(mockGuard)
      .compile();

    controller = module.get<ApiKeysController>(ApiKeysController);
    service = module.get<ApiKeysService>(ApiKeysService);

    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return list of API keys for current user', async () => {
      const mockKeys = [
        {
          id: 'key-1',
          label: 'Key 1',
          prefix: 'pk_live',
          lastFour: 'xyz1',
          rateLimitMax: 60,
          rateLimitWindowSec: 60,
          usageCount: '10',
          lastUsedAt: new Date(),
          createdAt: new Date(),
        },
      ];

      mockApiKeysService.listMyKeys.mockResolvedValue(mockKeys);

      const result = await controller.list(mockUser as User);

      expect(result).toEqual(mockKeys);
      expect(mockApiKeysService.listMyKeys).toHaveBeenCalledWith('user-123');
    });

    it('should return empty list if no keys exist', async () => {
      mockApiKeysService.listMyKeys.mockResolvedValue([]);

      const result = await controller.list(mockUser as User);

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create a new API key', async () => {
      const dto = {
        label: 'Test Key',
        expiresAt: null,
        rateLimitWindowSec: 60,
        rateLimitMax: 60,
      };

      const mockApiKey = {
        id: 'key-123',
        label: 'Test Key',
        prefix: 'pk_live',
        lastFour: 'xyz1',
        expiresAt: null,
        rateLimitMax: 60,
        rateLimitWindowSec: 60,
        usageCount: '0',
        lastUsedAt: null,
        createdAt: new Date(),
      };

      mockApiKeysService.createKey.mockResolvedValue({
        apiKey: mockApiKey,
        plaintextKey: 'pk_live_test123xyz',
      });

      const result = await controller.create(mockUser as User, dto);

      expect(result.plaintextKey).toBe('pk_live_test123xyz');
      expect(result.label).toBe('Test Key');
      expect(result.id).toBe('key-123');
      expect(mockApiKeysService.createKey).toHaveBeenCalledWith({
        userId: 'user-123',
        label: 'Test Key',
        expiresAt: null,
        rateLimitMax: 60,
        rateLimitWindowSec: 60,
      });
    });

    it('should use defaults if not provided', async () => {
      const dto = {
        label: 'Simple Key',
      };

      mockApiKeysService.createKey.mockResolvedValue({
        apiKey: { id: 'key-123', label: 'Simple Key' },
        plaintextKey: 'pk_live_simple',
      });

      await controller.create(mockUser as User, dto);

      expect(mockApiKeysService.createKey).toHaveBeenCalledWith({
        userId: 'user-123',
        label: 'Simple Key',
        expiresAt: null,
        rateLimitMax: undefined,
        rateLimitWindowSec: undefined,
      });
    });

    it('should handle expiration date', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const dto = {
        label: 'Expiring Key',
        expiresAt: futureDate,
      };

      mockApiKeysService.createKey.mockResolvedValue({
        apiKey: { id: 'key-123' },
        plaintextKey: 'pk_live_expiring',
      });

      await controller.create(mockUser as User, dto);

      const call = mockApiKeysService.createKey.mock.calls[0][0];
      expect(call.expiresAt).toEqual(futureDate);
    });
  });

  describe('revoke', () => {
    it('should revoke an API key', async () => {
      mockApiKeysService.revokeKey.mockResolvedValue({
        id: 'key-123',
        revokedAt: new Date(),
      });

      const result = await controller.revoke('key-123', mockUser as User);

      expect(result).toBeUndefined();
      expect(mockApiKeysService.revokeKey).toHaveBeenCalledWith(
        'key-123',
        'user-123',
      );
    });

    it('should handle revoke errors gracefully', async () => {
      mockApiKeysService.revokeKey.mockRejectedValue(
        new Error('Not owned by user'),
      );
      mockApiKeysService.adminRevokeKey = jest.fn().mockResolvedValue({
        id: 'key-123',
        revokedAt: new Date(),
      });

      const result = await controller.revoke('key-123', mockUser as User);

      expect(result).toBeUndefined();
    });
  });
});
