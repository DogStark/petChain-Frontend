import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { UsersService } from '../modules/users/users.service';
import { User } from '../modules/users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Session } from './entities/session.entity';
import {
  EMAIL_SERVICE,
  type EmailService,
} from './interfaces/email-service.interface';
import { PasswordUtil } from './utils/password.util';
import { DeviceFingerprintUtil } from './utils/device-fingerprint.util';
import { TokenUtil } from './utils/token.util';
import { SmsService } from '../modules/sms/sms.service';
import { UserPreferenceService } from '../modules/users/services/user-preference.service';
import { PasswordResetService } from './services/password-reset.service';
import { LoginAttemptService } from './services/login-attempt.service';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let refreshTokenRepository: Repository<RefreshToken>;
  let sessionRepository: Repository<Session>;
  let usersService: UsersService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let emailService: EmailService;

  const mockUserRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockRefreshTokenRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
  };

  const mockSessionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockUsersService = {
    findByEmail: jest.fn(),
    findOne: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockEmailService: EmailService = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  };

  const mockSmsService = {
    sendSms: jest.fn(),
  };

  const mockUserPreferenceService = {
    createDefaultPreferences: jest.fn(),
  };

  const mockPasswordResetService = {
    requestPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
  };

  const mockLoginAttemptService = {
    isAccountLocked: jest.fn(),
    recordAttempt: jest.fn(),
    detectAnomaly: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepository,
        },
        {
          provide: getRepositoryToken(Session),
          useValue: mockSessionRepository,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EMAIL_SERVICE,
          useValue: mockEmailService,
        },
        {
          provide: SmsService,
          useValue: mockSmsService,
        },
        {
          provide: UserPreferenceService,
          useValue: mockUserPreferenceService,
        },
        {
          provide: PasswordResetService,
          useValue: mockPasswordResetService,
        },
        {
          provide: LoginAttemptService,
          useValue: mockLoginAttemptService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    refreshTokenRepository = module.get<Repository<RefreshToken>>(
      getRepositoryToken(RefreshToken),
    );
    sessionRepository = module.get<Repository<Session>>(
      getRepositoryToken(Session),
    );
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    emailService = module.get<EmailService>(EMAIL_SERVICE);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      password: 'Password123!',
      phone: '+15551234567',
    };

    it('should register a new user successfully', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      jest
        .spyOn(PasswordUtil, 'hashPassword')
        .mockResolvedValue('hashedPassword');
      jest
        .spyOn(TokenUtil, 'generateToken')
        .mockReturnValue('verification-token');
      jest
        .spyOn(TokenUtil, 'hashToken')
        .mockReturnValue('hashed-verification-token');
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'auth.emailVerificationExpiration') return '24h';
        if (key === 'auth.phoneVerificationExpiration') return '24h';
        return null;
      });

      const mockUser = {
        id: 'user-id',
        ...registerDto,
        password: 'hashedPassword',
        emailVerified: false,
        emailVerificationToken: 'hashed-verification-token',
        emailVerificationExpires: new Date(),
        phoneVerified: false,
        phoneVerificationCode: 'hashed-verification-token',
        phoneVerificationExpires: new Date(),
        isActive: true,
        failedLoginAttempts: 0,
      };

      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockSmsService.sendSms.mockResolvedValue({ success: true });
      mockUserPreferenceService.createDefaultPreferences.mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(PasswordUtil.hashPassword).toHaveBeenCalled();
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(
        mockUserPreferenceService.createDefaultPreferences,
      ).toHaveBeenCalledWith(mockUser.id);
      expect(result.email).toBe(registerDto.email);
      expect('password' in result).toBe(false);
    });

    it('should throw ConflictException if user already exists', async () => {
      const existingUser = { id: 'existing-id', email: registerDto.email };
      mockUsersService.findByEmail.mockResolvedValue(existingUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    const deviceFingerprintData = {
      userAgent: 'Mozilla/5.0',
      ipAddress: '192.168.1.1',
      acceptLanguage: 'en-US',
      acceptEncoding: 'gzip',
    };

    const mockUser = {
      id: 'user-id',
      email: 'test@example.com',
      password: 'hashedPassword',
      isActive: true,
      emailVerified: true,
      phoneVerified: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    };

    beforeEach(() => {
      jest
        .spyOn(DeviceFingerprintUtil, 'createFingerprint')
        .mockReturnValue('device-fingerprint');
      mockLoginAttemptService.isAccountLocked.mockResolvedValue({
        locked: false,
      });
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'auth.jwtAccessExpiration') return '15m';
        if (key === 'auth.jwtRefreshExpiration') return '7d';
        if (key === 'auth.maxConcurrentSessions') return 3;
        return null;
      });
      mockJwtService.sign.mockReturnValue('access-token');
      jest
        .spyOn(TokenUtil, 'generateToken')
        .mockReturnValue('refresh-token-value');
      jest
        .spyOn(TokenUtil, 'hashToken')
        .mockReturnValue('hashed-refresh-token');
      mockSessionRepository.find.mockResolvedValue([]);
      mockRefreshTokenRepository.create.mockReturnValue({});
      mockRefreshTokenRepository.save.mockResolvedValue({});
    });

    it('should login successfully with valid credentials', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      jest.spyOn(PasswordUtil, 'comparePassword').mockResolvedValue(true);
      mockLoginAttemptService.isAccountLocked.mockResolvedValue({
        locked: false,
      });
      mockLoginAttemptService.recordAttempt.mockResolvedValue({
        id: 'hist-1',
        userId: mockUser.id,
      });
      mockLoginAttemptService.detectAnomaly.mockResolvedValue({
        anomalous: false,
      });

      const result = await service.login(loginDto, deviceFingerprintData);

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(PasswordUtil.comparePassword).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(mockLoginAttemptService.recordAttempt).toHaveBeenCalled();
      expect(mockLoginAttemptService.detectAnomaly).toHaveBeenCalled();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe(loginDto.email);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (
        PasswordUtil.comparePassword as jest.MockedFunction<
          typeof PasswordUtil.comparePassword
        >
      ).mockResolvedValue(false);
      mockLoginAttemptService.isAccountLocked.mockResolvedValue({
        locked: false,
      });
      mockLoginAttemptService.recordAttempt.mockResolvedValue(null);

      await expect(
        service.login(loginDto, deviceFingerprintData),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login(loginDto, deviceFingerprintData),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return 423 if account is locked', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      };
      mockUsersService.findByEmail.mockResolvedValue(lockedUser);
      mockLoginAttemptService.isAccountLocked.mockResolvedValue({
        locked: true,
        unlocksAt: lockedUser.lockedUntil,
      });

      await expect(
        service.login(loginDto, deviceFingerprintData),
      ).rejects.toMatchObject({ status: 423 });
    });

    it('should increment failed login attempts on wrong password', async () => {
      const userWithAttempts = { ...mockUser, failedLoginAttempts: 3 };
      mockUsersService.findByEmail.mockResolvedValue(userWithAttempts);
      (
        PasswordUtil.comparePassword as jest.MockedFunction<
          typeof PasswordUtil.comparePassword
        >
      ).mockResolvedValue(false);
      mockLoginAttemptService.isAccountLocked.mockResolvedValue({
        locked: false,
      });
      mockLoginAttemptService.recordAttempt.mockResolvedValue(null);

      await expect(
        service.login(loginDto, deviceFingerprintData),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockLoginAttemptService.recordAttempt).toHaveBeenCalledWith(
        userWithAttempts.id,
        false,
        deviceFingerprintData.ipAddress,
        deviceFingerprintData.userAgent,
      );
    });

    it('should propagate 423 when lockout triggers on failed attempt', async () => {
      const userWithAttempts = { ...mockUser, failedLoginAttempts: 4 };
      mockUsersService.findByEmail.mockResolvedValue(userWithAttempts);
      (
        PasswordUtil.comparePassword as jest.MockedFunction<
          typeof PasswordUtil.comparePassword
        >
      ).mockResolvedValue(false);
      mockLoginAttemptService.isAccountLocked.mockResolvedValue({
        locked: false,
      });
      const lockedErr = new HttpException(
        { message: 'locked' },
        HttpStatus.LOCKED,
      );
      mockLoginAttemptService.recordAttempt.mockRejectedValue(lockedErr);

      await expect(
        service.login(loginDto, deviceFingerprintData),
      ).rejects.toMatchObject({ status: 423 });
    });
  });

  describe('refresh', () => {
    const refreshDto = {
      refreshToken: 'refresh-token-value',
    };

    const deviceFingerprintData = {
      userAgent: 'Mozilla/5.0',
      ipAddress: '192.168.1.1',
    };

    const mockRefreshToken = {
      id: 'token-id',
      token: 'hashed-refresh-token',
      userId: 'user-id',
      deviceFingerprint: 'device-fingerprint',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      replacedBy: null,
      user: {
        id: 'user-id',
        email: 'test@example.com',
        isActive: true,
      },
    };

    beforeEach(() => {
      (
        TokenUtil.hashToken as jest.MockedFunction<typeof TokenUtil.hashToken>
      ).mockReturnValue('hashed-refresh-token');
      jest
        .spyOn(DeviceFingerprintUtil, 'createFingerprint')
        .mockReturnValue('device-fingerprint');
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'auth.jwtAccessExpiration') return '15m';
        if (key === 'auth.jwtRefreshExpiration') return '7d';
        return null;
      });
      mockJwtService.sign.mockReturnValue('new-access-token');
      jest
        .spyOn(TokenUtil, 'generateToken')
        .mockReturnValue('new-refresh-token');
      mockSessionRepository.findOne.mockResolvedValue({});
      mockSessionRepository.save.mockResolvedValue({});
    });

    it('should refresh tokens successfully', async () => {
      mockRefreshTokenRepository.findOne.mockResolvedValue(mockRefreshToken);
      mockRefreshTokenRepository.remove.mockResolvedValue(mockRefreshToken);
      mockRefreshTokenRepository.create.mockReturnValue({});
      mockRefreshTokenRepository.save.mockResolvedValue({});

      const result = await service.refresh(refreshDto, deviceFingerprintData);

      expect(mockRefreshTokenRepository.findOne).toHaveBeenCalled();
      expect(mockRefreshTokenRepository.remove).toHaveBeenCalled();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockRefreshTokenRepository.findOne.mockResolvedValue(null);

      await expect(
        service.refresh(refreshDto, deviceFingerprintData),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      const expiredToken = {
        ...mockRefreshToken,
        expiresAt: new Date(Date.now() - 1000), // Expired
      };
      mockRefreshTokenRepository.findOne.mockResolvedValue(expiredToken);

      await expect(
        service.refresh(refreshDto, deviceFingerprintData),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockRefreshTokenRepository.remove).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for replaced refresh token', async () => {
      const replacedToken = {
        ...mockRefreshToken,
        replacedBy: 'new-token-id',
      };
      mockRefreshTokenRepository.findOne.mockResolvedValue(replacedToken);

      await expect(
        service.refresh(refreshDto, deviceFingerprintData),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for device fingerprint mismatch', async () => {
      (
        DeviceFingerprintUtil.createFingerprint as jest.MockedFunction<
          typeof DeviceFingerprintUtil.createFingerprint
        >
      ).mockReturnValue('different-fingerprint');
      mockRefreshTokenRepository.findOne.mockResolvedValue(mockRefreshToken);

      await expect(
        service.refresh(refreshDto, deviceFingerprintData),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyEmail', () => {
    const verifyEmailDto = {
      token: 'verification-token',
    };

    it('should verify email successfully', async () => {
      jest.spyOn(TokenUtil, 'hashToken').mockReturnValue('hashed-token');
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        emailVerified: false,
        phoneVerified: false,
        emailVerificationToken: 'hashed-token',
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        emailVerified: true,
      });

      const result = await service.verifyEmail(verifyEmailDto);

      expect(TokenUtil.hashToken).toHaveBeenCalledWith(verifyEmailDto.token);
      expect(mockUserRepository.findOne).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result.emailVerified).toBe(true);
    });

    it('should throw BadRequestException for invalid token', async () => {
      jest.spyOn(TokenUtil, 'hashToken').mockReturnValue('hashed-token');
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyEmail(verifyEmailDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for expired token', async () => {
      jest.spyOn(TokenUtil, 'hashToken').mockReturnValue('hashed-token');
      const mockUser = {
        id: 'user-id',
        emailVerificationToken: 'hashed-token',
        emailVerificationExpires: new Date(Date.now() - 1000), // Expired
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.verifyEmail(verifyEmailDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyPhone', () => {
    const verifyPhoneDto = {
      email: 'test@example.com',
      code: '123456',
    };

    it('should verify phone successfully', async () => {
      jest.spyOn(TokenUtil, 'hashToken').mockReturnValue('hashed-code');
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        emailVerified: true,
        phoneVerified: false,
        phoneVerificationCode: 'hashed-code',
        phoneVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        phoneVerified: true,
      });

      const result = await service.verifyPhone(verifyPhoneDto);

      expect(result.phoneVerified).toBe(true);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should throw when the code is invalid', async () => {
      jest.spyOn(TokenUtil, 'hashToken').mockReturnValue('wrong-code');
      mockUsersService.findByEmail.mockResolvedValue({
        phoneVerificationCode: 'hashed-code',
        phoneVerificationExpires: new Date(Date.now() + 1000),
      });

      await expect(service.verifyPhone(verifyPhoneDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('forgotPassword', () => {
    const forgotPasswordDto = {
      email: 'test@example.com',
    };

    it('should delegate password reset request with IP', async () => {
      mockPasswordResetService.requestPasswordReset.mockResolvedValue(
        undefined,
      );

      await service.forgotPassword(forgotPasswordDto, '203.0.113.1');

      expect(
        mockPasswordResetService.requestPasswordReset,
      ).toHaveBeenCalledWith(forgotPasswordDto.email, '203.0.113.1');
    });

    it('should not throw error if user does not exist (security)', async () => {
      mockPasswordResetService.requestPasswordReset.mockResolvedValue(
        undefined,
      );

      await expect(
        service.forgotPassword(forgotPasswordDto, '127.0.0.1'),
      ).resolves.not.toThrow();
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const refreshToken = 'refresh-token';
      const userId = 'user-id';
      jest.spyOn(TokenUtil, 'hashToken').mockReturnValue('hashed-token');
      mockRefreshTokenRepository.findOne.mockResolvedValue({
        id: 'token-id',
        deviceFingerprint: 'device-fingerprint',
      });
      mockRefreshTokenRepository.remove.mockResolvedValue({});
      mockSessionRepository.find.mockResolvedValue([
        { deviceFingerprint: 'device-fingerprint' },
      ]);
      mockSessionRepository.remove.mockResolvedValue({});

      await service.logout(refreshToken, userId);

      expect(TokenUtil.hashToken).toHaveBeenCalledWith(refreshToken);
      expect(mockRefreshTokenRepository.findOne).toHaveBeenCalled();
      expect(mockRefreshTokenRepository.remove).toHaveBeenCalled();
    });
  });
});
