import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { UsersService } from '../modules/users/users.service';
import { User } from '../modules/users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Session } from './entities/session.entity';
import { EmailService } from './interfaces/email-service.interface';
import { EmailServiceImpl } from './services/email.service';
import { PasswordUtil } from './utils/password.util';
import { DeviceFingerprintUtil } from './utils/device-fingerprint.util';
import { TokenUtil } from './utils/token.util';

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
          provide: EmailService,
          useValue: mockEmailService,
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
    emailService = module.get<EmailService>(EmailService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      password: 'Password123!',
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
        return null;
      });

      const mockUser = {
        id: 'user-id',
        ...registerDto,
        password: 'hashedPassword',
        emailVerified: false,
        emailVerificationToken: 'hashed-verification-token',
        emailVerificationExpires: new Date(),
        isActive: true,
        failedLoginAttempts: 0,
      };

      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await service.register(registerDto);

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(PasswordUtil.hashPassword).toHaveBeenCalled();
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result.email).toBe(registerDto.email);
      expect(result.password).toBeUndefined();
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
      failedLoginAttempts: 0,
      lockedUntil: null,
    };

    beforeEach(() => {
      jest
        .spyOn(DeviceFingerprintUtil, 'createFingerprint')
        .mockReturnValue('device-fingerprint');
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

      const result = await service.login(loginDto, deviceFingerprintData);

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(PasswordUtil.comparePassword).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
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

    it('should throw ForbiddenException if account is locked', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
      };
      mockUsersService.findByEmail.mockResolvedValue(lockedUser);

      await expect(
        service.login(loginDto, deviceFingerprintData),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should increment failed login attempts on wrong password', async () => {
      const userWithAttempts = { ...mockUser, failedLoginAttempts: 3 };
      mockUsersService.findByEmail.mockResolvedValue(userWithAttempts);
      (
        PasswordUtil.comparePassword as jest.MockedFunction<
          typeof PasswordUtil.comparePassword
        >
      ).mockResolvedValue(false);
      mockUserRepository.save.mockResolvedValue(userWithAttempts);
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'auth.maxFailedLoginAttempts') return 5;
        return null;
      });

      await expect(
        service.login(loginDto, deviceFingerprintData),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should lock account after max failed attempts', async () => {
      const userWithAttempts = { ...mockUser, failedLoginAttempts: 4 };
      mockUsersService.findByEmail.mockResolvedValue(userWithAttempts);
      (
        PasswordUtil.comparePassword as jest.MockedFunction<
          typeof PasswordUtil.comparePassword
        >
      ).mockResolvedValue(false);
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'auth.maxFailedLoginAttempts') return 5;
        if (key === 'auth.accountLockoutDuration') return '15m';
        return null;
      });
      mockUserRepository.save.mockResolvedValue({
        ...userWithAttempts,
        lockedUntil: new Date(),
      });

      await expect(
        service.login(loginDto, deviceFingerprintData),
      ).rejects.toThrow(ForbiddenException);
      expect(mockUserRepository.save).toHaveBeenCalled();
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
        emailVerificationToken: 'hashed-token',
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        emailVerified: true,
      });

      await service.verifyEmail(verifyEmailDto);

      expect(TokenUtil.hashToken).toHaveBeenCalledWith(verifyEmailDto.token);
      expect(mockUserRepository.findOne).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
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

  describe('forgotPassword', () => {
    const forgotPasswordDto = {
      email: 'test@example.com',
    };

    it('should generate password reset token for existing user', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
      };
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (
        TokenUtil.generateToken as jest.MockedFunction<
          typeof TokenUtil.generateToken
        >
      ).mockReturnValue('reset-token');
      (
        TokenUtil.hashToken as jest.MockedFunction<typeof TokenUtil.hashToken>
      ).mockReturnValue('hashed-reset-token');
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'auth.passwordResetExpiration') return '1h';
        return null;
      });
      mockUserRepository.save.mockResolvedValue(mockUser);

      await service.forgotPassword(forgotPasswordDto);

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        forgotPasswordDto.email,
      );
      expect(TokenUtil.generateToken).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should not throw error if user does not exist (security)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.forgotPassword(forgotPasswordDto),
      ).resolves.not.toThrow();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
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
