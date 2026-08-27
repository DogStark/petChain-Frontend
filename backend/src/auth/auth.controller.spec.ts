import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DeviceFingerprintUtil } from './utils/device-fingerprint.util';

jest.mock('./utils/device-fingerprint.util');

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    verifyEmail: jest.fn(),
    resendEmailVerification: jest.fn(),
    verifyPhone: jest.fn(),
    resendPhoneVerification: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    requestPasswordReset: jest.fn(),
    confirmPasswordReset: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
    (DeviceFingerprintUtil.extractFromRequest as jest.Mock) = jest.fn();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto = {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'Password123!',
        phone: '+15551234567',
      };

      const expectedUser = {
        id: 'user-id',
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
      };

      mockAuthService.register.mockResolvedValue(expectedUser);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(expectedUser);
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const mockRequest = {
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
        ip: '192.168.1.1',
      };

      const expectedResponse = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-id',
          email: loginDto.email,
        },
      };

      (DeviceFingerprintUtil.extractFromRequest as jest.Mock).mockReturnValue({
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      });
      mockAuthService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(loginDto, mockRequest as any);

      expect(DeviceFingerprintUtil.extractFromRequest).toHaveBeenCalledWith(
        mockRequest,
      );
      expect(authService.login).toHaveBeenCalledWith(
        loginDto,
        expect.any(Object),
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('refresh', () => {
    it('should refresh tokens successfully', async () => {
      const refreshDto = {
        refreshToken: 'refresh-token',
      };

      const mockRequest = {
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
        ip: '192.168.1.1',
      };

      const expectedResponse = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: {
          id: 'user-id',
          email: 'test@example.com',
        },
      };

      (DeviceFingerprintUtil.extractFromRequest as jest.Mock).mockReturnValue({
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      });
      mockAuthService.refresh.mockResolvedValue(expectedResponse);

      const result = await controller.refresh(refreshDto, mockRequest as any);

      expect(DeviceFingerprintUtil.extractFromRequest).toHaveBeenCalledWith(
        mockRequest,
      );
      expect(authService.refresh).toHaveBeenCalledWith(
        refreshDto,
        expect.any(Object),
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const logoutDto = {
        refreshToken: 'refresh-token',
      };

      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
      };

      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(logoutDto, mockUser as any);

      expect(authService.logout).toHaveBeenCalledWith(
        logoutDto.refreshToken,
        mockUser.id,
      );
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const verifyEmailDto = {
        token: 'verification-token',
      };

      mockAuthService.verifyEmail.mockResolvedValue({
        message: 'Email verified successfully',
        emailVerified: true,
        phoneVerified: false,
        isVerified: false,
        email: 'test@example.com',
      });

      const result = await controller.verifyEmail(verifyEmailDto);

      expect(authService.verifyEmail).toHaveBeenCalledWith(verifyEmailDto);
      expect(result).toEqual({
        message: 'Email verified successfully',
        emailVerified: true,
        phoneVerified: false,
        isVerified: false,
        email: 'test@example.com',
      });
    });
  });

  describe('verifyPhone', () => {
    it('should verify phone successfully', async () => {
      const verifyPhoneDto = {
        email: 'test@example.com',
        code: '123456',
      };

      mockAuthService.verifyPhone.mockResolvedValue({
        message: 'Phone number verified successfully',
        emailVerified: true,
        phoneVerified: true,
        isVerified: true,
      });

      const result = await controller.verifyPhone(verifyPhoneDto);

      expect(authService.verifyPhone).toHaveBeenCalledWith(verifyPhoneDto);
      expect(result).toEqual({
        message: 'Phone number verified successfully',
        emailVerified: true,
        phoneVerified: true,
        isVerified: true,
      });
    });
  });

  describe('resend verification', () => {
    it('should resend email verification successfully', async () => {
      const dto = { email: 'test@example.com' };
      mockAuthService.resendEmailVerification.mockResolvedValue(undefined);

      const result = await controller.resendEmailVerification(dto);

      expect(authService.resendEmailVerification).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        message: 'If the account exists, a new verification email was sent',
      });
    });

    it('should resend phone verification successfully', async () => {
      const dto = { email: 'test@example.com' };
      mockAuthService.resendPhoneVerification.mockResolvedValue(undefined);

      const result = await controller.resendPhoneVerification(dto);

      expect(authService.resendPhoneVerification).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        message: 'If the account exists, a new verification code was sent',
      });
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset email', async () => {
      const forgotPasswordDto = {
        email: 'test@example.com',
      };

      const mockRequest = { ip: '192.168.1.2' };
      (DeviceFingerprintUtil.extractFromRequest as jest.Mock).mockReturnValue({
        ipAddress: '192.168.1.2',
        userAgent: 'Mozilla/5.0',
      });
      mockAuthService.forgotPassword.mockResolvedValue(undefined);

      const result = await controller.forgotPassword(
        forgotPasswordDto,
        mockRequest as any,
      );

      expect(authService.forgotPassword).toHaveBeenCalledWith(
        forgotPasswordDto,
        '192.168.1.2',
      );
      expect(result).toEqual({
        message: 'If the email exists, a password reset link has been sent',
      });
    });
  });

  describe('password-reset (Issue #145)', () => {
    it('should request password reset', async () => {
      const mockRequest = { ip: '10.0.0.1' };
      (DeviceFingerprintUtil.extractFromRequest as jest.Mock).mockReturnValue({
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0',
      });
      mockAuthService.requestPasswordReset.mockResolvedValue(undefined);

      const res = await controller.passwordResetRequest(
        { email: 'a@b.com' },
        mockRequest as any,
      );

      expect(authService.requestPasswordReset).toHaveBeenCalledWith(
        'a@b.com',
        '10.0.0.1',
      );
      expect(res.message).toContain('password reset');
    });

    it('should confirm password reset', async () => {
      mockAuthService.confirmPasswordReset.mockResolvedValue(undefined);

      const res = await controller.passwordResetConfirm({
        token: 'tok',
        newPassword: 'Password123!',
      });

      expect(authService.confirmPasswordReset).toHaveBeenCalledWith(
        'tok',
        'Password123!',
      );
      expect(res.message).toContain('success');
    });
  });
});
