import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';
import { User } from '../../modules/users/entities/user.entity';
import { AuthSecurityEvent } from '../entities/auth-security-event.entity';
import { EmailNotificationService } from './email-notification.service';
import { SessionService } from './session.service';
import { PasswordUtil } from '../utils/password.util';
import { TokenUtil } from '../utils/token.util';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let userRepo: jest.Mocked<Repository<User>>;
  let securityRepo: jest.Mocked<Repository<AuthSecurityEvent>>;
  let sessionService: SessionService;
  let emailNotification: EmailNotificationService;

  const mockUserRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockSecurityRepo = {
    create: jest.fn((x) => x),
    save: jest.fn(),
  };

  const mockConfig = { get: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        {
          provide: getRepositoryToken(AuthSecurityEvent),
          useValue: mockSecurityRepo,
        },
        { provide: ConfigService, useValue: mockConfig },
        {
          provide: EmailNotificationService,
          useValue: {
            sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
            sendPasswordResetConfirmationEmail: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
        {
          provide: SessionService,
          useValue: { invalidateAllSessions: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(PasswordResetService);
    userRepo = module.get(getRepositoryToken(User));
    securityRepo = module.get(getRepositoryToken(AuthSecurityEvent));
    sessionService = module.get(SessionService);
    emailNotification = module.get(EmailNotificationService);
    jest.clearAllMocks();
  });

  describe('requestPasswordReset', () => {
    it('stores hashed token and expiry and logs event', async () => {
      const user = {
        id: 'u1',
        email: 'e@e.com',
      } as User;
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation(async (u: any) => u);
      mockConfig.get.mockReturnValue('http://app.test');
      jest.spyOn(TokenUtil, 'hashToken').mockReturnValue('hashed');

      await service.requestPasswordReset('e@e.com', '1.1.1.1');
      await new Promise((r) => setImmediate(r));

      expect(user.passwordResetToken).toBe('hashed');
      expect(user.passwordResetTokenExpiresAt).toBeInstanceOf(Date);
      expect(mockSecurityRepo.save).toHaveBeenCalled();
      expect(emailNotification.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('does nothing when email unknown', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await service.requestPasswordReset('x@x.com', '1.1.1.1');
      expect(userRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('updates password and invalidates sessions', async () => {
      const token = 'abc';
      jest.spyOn(TokenUtil, 'hashToken').mockReturnValue('h');
      const user = {
        id: 'u1',
        email: 'e@e.com',
        passwordResetToken: 'h',
        passwordResetTokenExpiresAt: new Date(Date.now() + 60_000),
      } as User;
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation(async (u: any) => u);
      jest.spyOn(PasswordUtil, 'hashPassword').mockResolvedValue('newhash');
      mockConfig.get.mockReturnValue(12);

      await service.resetPassword(token, 'Password123!');

      expect(user.password).toBe('newhash');
      expect(user.passwordChangedAt).toBeInstanceOf(Date);
      expect(user.passwordResetToken).toBeNull();
      expect(sessionService.invalidateAllSessions).toHaveBeenCalledWith('u1');
      expect(
        emailNotification.sendPasswordResetConfirmationEmail,
      ).toHaveBeenCalledWith('e@e.com');
    });

    it('rejects invalid token', async () => {
      jest.spyOn(TokenUtil, 'hashToken').mockReturnValue('h');
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.resetPassword('bad', 'Password123!'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
