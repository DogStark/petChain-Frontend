import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

jest.mock(
  'speakeasy',
  () => ({
    generateSecret: jest.fn(() => ({
      base32: 'SECRETBASE32',
      otpauth_url: 'otpauth://totp/PetChain?secret=SECRETBASE32',
    })),
    totp: {
      verify: jest.fn(),
    },
  }),
  { virtual: true },
);

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,fake'),
}));

import { MfaService } from './mfa.service';
import { MfaConfig } from './entities/mfa-config.entity';

const speakeasy = jest.requireMock('speakeasy') as {
  generateSecret: jest.Mock;
  totp: { verify: jest.Mock };
};

describe('MfaService', () => {
  let service: MfaService;
  let repo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve(data)),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MfaService,
        { provide: getRepositoryToken(MfaConfig), useValue: repo },
      ],
    }).compile();

    service = module.get<MfaService>(MfaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setupMfa', () => {
    it('generates a secret and persists a disabled config', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.setupMfa('user-1');

      expect(result.secret).toBe('SECRETBASE32');
      expect(result.qrCodeUrl).toContain('data:image/png');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ secret: 'SECRETBASE32', isEnabled: false }),
      );
    });
  });

  describe('enableMfa', () => {
    it('throws if MFA setup was never initiated', async () => {
      repo.findOne.mockResolvedValue({ userId: 'user-1', secret: null });
      await expect(service.enableMfa('user-1', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws UnauthorizedException for an invalid token', async () => {
      repo.findOne.mockResolvedValue({ userId: 'user-1', secret: 'SECRETBASE32' });
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      await expect(service.enableMfa('user-1', 'bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('enables MFA and returns backup codes for a valid token', async () => {
      repo.findOne.mockResolvedValue({ userId: 'user-1', secret: 'SECRETBASE32' });
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      const result = await service.enableMfa('user-1', '123456');

      expect(result.backupCodes).toHaveLength(10);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isEnabled: true }),
      );
    });
  });

  describe('verifyTotp', () => {
    it('returns false when MFA is not enabled', async () => {
      repo.findOne.mockResolvedValue({ userId: 'user-1', isEnabled: false, secret: 'x' });
      const result = await service.verifyTotp('user-1', '123456');
      expect(result).toBe(false);
    });

    it('delegates to speakeasy when MFA is enabled', async () => {
      repo.findOne.mockResolvedValue({ userId: 'user-1', isEnabled: true, secret: 'SECRETBASE32' });
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      const result = await service.verifyTotp('user-1', '123456');
      expect(result).toBe(true);
    });

    it('throws NotFoundException when no config exists', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.verifyTotp('user-1', '123456')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('verifyBackupCode', () => {
    it('returns false when MFA is not enabled', async () => {
      repo.findOne.mockResolvedValue({ isEnabled: false, backupCodes: [], usedBackupCodes: [] });
      const result = await service.verifyBackupCode('user-1', 'ABCDE12345');
      expect(result).toBe(false);
    });

    it('rejects an already-used backup code', async () => {
      const crypto = require('crypto');
      const hashed = crypto.createHash('sha256').update('ABCDE12345').digest('hex');
      repo.findOne.mockResolvedValue({
        isEnabled: true,
        backupCodes: [hashed],
        usedBackupCodes: [hashed],
      });

      const result = await service.verifyBackupCode('user-1', 'ABCDE12345');
      expect(result).toBe(false);
    });

    it('accepts a valid, unused backup code and marks it used', async () => {
      const crypto = require('crypto');
      const hashed = crypto.createHash('sha256').update('ABCDE12345').digest('hex');
      const config = { isEnabled: true, backupCodes: [hashed], usedBackupCodes: [] };
      repo.findOne.mockResolvedValue(config);

      const result = await service.verifyBackupCode('user-1', 'ABCDE12345');

      expect(result).toBe(true);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ usedBackupCodes: [hashed] }),
      );
    });
  });
});
