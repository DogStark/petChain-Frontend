import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Repository } from 'typeorm';
import { LoginAttemptService } from './login-attempt.service';
import { User } from '../../modules/users/entities/user.entity';
import { LoginHistory } from '../entities/login-history.entity';
import { AuthSecurityEvent } from '../entities/auth-security-event.entity';
import { EmailNotificationService } from './email-notification.service';

describe('LoginAttemptService', () => {
  let service: LoginAttemptService;
  let userRepo: jest.Mocked<Pick<Repository<User>, 'findOne' | 'save'>>;
  let historyRepo: jest.Mocked<
    Pick<Repository<LoginHistory>, 'create' | 'save' | 'find' | 'update'>
  >;
  let securityRepo: jest.Mocked<Pick<Repository<AuthSecurityEvent>, 'create' | 'save'>>;

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    historyRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    };
    securityRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginAttemptService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(LoginHistory), useValue: historyRepo },
        {
          provide: getRepositoryToken(AuthSecurityEvent),
          useValue: securityRepo,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('30m') },
        },
        {
          provide: EmailNotificationService,
          useValue: {
            sendAccountLockedEmail: jest.fn().mockResolvedValue(undefined),
            sendSuspiciousLoginEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(LoginAttemptService);
    jest.clearAllMocks();
  });

  it('locks after 5 failures and throws 423', async () => {
    const user = {
      id: 'u1',
      email: 'e@e.com',
      failedLoginAttempts: 4,
    } as User;
    userRepo.findOne.mockResolvedValue(user);
    userRepo.save.mockResolvedValue(user);
    historyRepo.save.mockResolvedValue({ id: 'h1' } as LoginHistory);

    await expect(
      service.recordAttempt('u1', false, 'ip', 'ua'),
    ).rejects.toMatchObject({ status: HttpStatus.LOCKED });

    expect(user.failedLoginAttempts).toBe(5);
    expect(user.lockedUntil).toBeInstanceOf(Date);
  });

  it('clears expired lock and returns unlocked', async () => {
    const user = {
      id: 'u1',
      failedLoginAttempts: 0,
      lockedUntil: new Date(Date.now() - 1000),
    } as User;
    userRepo.findOne.mockResolvedValue(user);
    userRepo.save.mockResolvedValue(user);

    const state = await service.isAccountLocked('u1');
    expect(state.locked).toBe(false);
    expect(securityRepo.save).toHaveBeenCalled();
  });

  it('flags new IP as anomaly when prior logins exist', async () => {
    const user = { id: 'u1', email: 'e@e.com' } as User;
    userRepo.findOne.mockResolvedValue(user);
    historyRepo.find.mockResolvedValue([
      { ipAddress: 'old', userAgent: 'same-ua', id: 'y' },
    ] as LoginHistory[]);
    historyRepo.update.mockResolvedValue({} as any);

    const result = await service.detectAnomaly(
      'u1',
      'brand-new-ip',
      'same-ua',
      'hist-new',
    );

    expect(result.anomalous).toBe(true);
    expect(historyRepo.update).toHaveBeenCalled();
  });
});
