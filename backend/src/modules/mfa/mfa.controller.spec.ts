import { Test, TestingModule } from '@nestjs/testing';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';
import { User } from '../users/entities/user.entity';

describe('MfaController', () => {
  let controller: MfaController;
  let service: MfaService;

  const mockMfaService = {
    setupTotp: jest.fn(),
    verifyAndEnableTotp: jest.fn(),
    setupBackupCodes: jest.fn(),
    consumeBackupCode: jest.fn(),
    disableMfa: jest.fn(),
  };

  const mockUser: Partial<User> = {
    id: 'user-123',
    email: 'test@example.com',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MfaController],
      providers: [
        {
          provide: MfaService,
          useValue: mockMfaService,
        },
      ],
    }).compile();

    controller = module.get<MfaController>(MfaController);
    service = module.get<MfaService>(MfaService);

    jest.clearAllMocks();
  });

  describe('setupTotp', () => {
    it('should initiate TOTP setup', async () => {
      const mockSecret = 'JBSWY3DPEBLW64TMMQ======';
      mockMfaService.setupTotp.mockResolvedValue({
        secret: mockSecret,
        record: { id: 'mfa-123' },
      });

      const result = await controller.setupTotp(mockUser as User);

      expect(result.secret).toBe(mockSecret);
      expect(result.recordId).toBe('mfa-123');
      expect(result.message).toBeTruthy();
      expect(mockMfaService.setupTotp).toHaveBeenCalledWith('user-123');
    });
  });

  describe('verifyTotp', () => {
    it('should verify TOTP code and enable MFA', async () => {
      mockMfaService.verifyAndEnableTotp.mockResolvedValue({
        id: 'mfa-123',
        verified: true,
      });

      const result = await controller.verifyTotp(
        'mfa-123',
        mockUser as User,
        { code: '123456' },
      );

      expect(result.verified).toBe(true);
      expect(result.message).toBeTruthy();
      expect(mockMfaService.verifyAndEnableTotp).toHaveBeenCalledWith(
        'mfa-123',
        'user-123',
        '123456',
      );
    });

    it('should handle TOTP verification errors', async () => {
      mockMfaService.verifyAndEnableTotp.mockRejectedValue(
        new Error('Invalid code'),
      );

      await expect(
        controller.verifyTotp('mfa-123', mockUser as User, { code: '000000' }),
      ).rejects.toThrow();
    });
  });

  describe('setupBackupCodes', () => {
    it('should generate and return backup codes', async () => {
      const mockCodes = ['ABC12345', 'DEF67890'];
      mockMfaService.setupBackupCodes.mockResolvedValue({
        codes: mockCodes,
        record: { id: 'mfa-456' },
      });

      const result = await controller.setupBackupCodes(mockUser as User);

      expect(result.codes).toEqual(mockCodes);
      expect(result.recordId).toBe('mfa-456');
      expect(result.message).toBeTruthy();
      expect(mockMfaService.setupBackupCodes).toHaveBeenCalledWith('user-123');
    });
  });

  describe('verifyBackupCode', () => {
    it('should verify a valid backup code', async () => {
      mockMfaService.consumeBackupCode.mockResolvedValue(true);

      const result = await controller.verifyBackupCode(
        'mfa-456',
        mockUser as User,
        { code: 'ABC12345' },
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('verified');
      expect(mockMfaService.consumeBackupCode).toHaveBeenCalledWith(
        'mfa-456',
        'user-123',
        'ABC12345',
      );
    });

    it('should reject invalid backup code', async () => {
      mockMfaService.consumeBackupCode.mockResolvedValue(false);

      const result = await controller.verifyBackupCode(
        'mfa-456',
        mockUser as User,
        { code: 'INVALID1' },
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid');
    });
  });

  describe('disableMfa', () => {
    it('should disable MFA for user', async () => {
      mockMfaService.disableMfa.mockResolvedValue(undefined);

      const result = await controller.disableMfa('mfa-123', mockUser as User);

      expect(result.message).toContain('disabled');
      expect(mockMfaService.disableMfa).toHaveBeenCalledWith(
        'mfa-123',
        'user-123',
      );
    });
  });
});
