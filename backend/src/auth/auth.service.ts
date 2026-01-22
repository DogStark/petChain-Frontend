import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../modules/users/users.service';
import { User } from '../modules/users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Session } from './entities/session.entity';
import { RegisterDto, LoginDto, RefreshDto, VerifyEmailDto, ForgotPasswordDto } from './dto/auth.dto';
import { PasswordUtil } from './utils/password.util';
import { DeviceFingerprintUtil, DeviceFingerprintData } from './utils/device-fingerprint.util';
import { TokenUtil } from './utils/token.util';
import { Inject } from '@nestjs/common';
import { EmailService } from './interfaces/email-service.interface';
import { JwtPayload } from './strategies/jwt.strategy';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: Omit<User, 'password' | 'emailVerificationToken' | 'passwordResetToken'>;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(EmailService)
    private readonly emailService: EmailService,
  ) {}

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto): Promise<Omit<User, 'password' | 'emailVerificationToken' | 'passwordResetToken'>> {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const bcryptRounds = this.configService.get<number>('auth.bcryptRounds') || 12;
    const hashedPassword = await PasswordUtil.hashPassword(registerDto.password, bcryptRounds);

    // Generate email verification token
    const verificationToken = TokenUtil.generateToken();
    const verificationExpires = new Date();
    const expirationStr = this.configService.get<string>('auth.emailVerificationExpiration') || '24h';
    if (expirationStr.endsWith('h')) {
      verificationExpires.setHours(verificationExpires.getHours() + parseInt(expirationStr.replace('h', ''), 10));
    } else if (expirationStr.endsWith('d')) {
      verificationExpires.setDate(verificationExpires.getDate() + parseInt(expirationStr.replace('d', ''), 10));
    } else {
      verificationExpires.setHours(verificationExpires.getHours() + 24); // Default 24 hours
    }

    // Create user
    const user = this.userRepository.create({
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      password: hashedPassword,
      emailVerified: false,
      emailVerificationToken: TokenUtil.hashToken(verificationToken),
      emailVerificationExpires: verificationExpires,
      isActive: true,
      failedLoginAttempts: 0,
    });

    const savedUser = await this.userRepository.save(user);

    // Send verification email
    try {
      await this.emailService.sendVerificationEmail(savedUser.email, verificationToken);
    } catch (error) {
      // Log error but don't fail registration
      console.error('Failed to send verification email:', error);
    }

    // Return user without sensitive data
    const { password, emailVerificationToken, passwordResetToken, ...userResponse } = savedUser;
    return userResponse as any;
  }

  /**
   * Login user
   */
  async login(
    loginDto: LoginDto,
    deviceFingerprintData: DeviceFingerprintData,
  ): Promise<AuthResponse> {
    // Find user
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(`Account is locked. Try again in ${minutesLeft} minute(s).`);
    }

    // Check if account is active
    if (!user.isActive) {
      throw new ForbiddenException('Account is inactive');
    }

    // Verify password
    if (!user.password || !(await PasswordUtil.comparePassword(loginDto.password, user.password))) {
      // Increment failed attempts
      user.failedLoginAttempts += 1;
      const maxAttempts = this.configService.get<number>('auth.maxFailedLoginAttempts') || 5;

      if (user.failedLoginAttempts >= maxAttempts) {
        // Lock account
        const lockoutDuration = this.configService.get<string>('auth.accountLockoutDuration') || '15m';
        const lockoutMinutes = parseInt(lockoutDuration.replace('m', ''), 10);
        user.lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
        await this.userRepository.save(user);
        throw new ForbiddenException(`Account locked due to too many failed attempts. Try again in ${lockoutMinutes} minutes.`);
      }

      await this.userRepository.save(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await this.userRepository.save(user);
    }

    // Check email verification (optional - can be made required)
    // if (!user.emailVerified) {
    //   throw new ForbiddenException('Please verify your email before logging in');
    // }

    // Create device fingerprint
    const deviceFingerprint = DeviceFingerprintUtil.createFingerprint(deviceFingerprintData);

    // Manage sessions (enforce concurrent session limit)
    await this.manageSessions(user.id, deviceFingerprint, deviceFingerprintData);

    // Generate tokens
    const tokens = await this.generateTokens(user, deviceFingerprint);

    // Return response
    const { password, emailVerificationToken, passwordResetToken, ...userResponse } = user;
    return {
      ...tokens,
      user: userResponse as any,
    };
  }

  /**
   * Refresh access token
   */
  async refresh(refreshDto: RefreshDto, deviceFingerprintData: DeviceFingerprintData): Promise<AuthResponse> {
    // Find refresh token
    const refreshTokenHash = TokenUtil.hashToken(refreshDto.refreshToken);
    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenHash },
      relations: ['user'],
    });

    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is expired
    if (refreshToken.expiresAt < new Date()) {
      await this.refreshTokenRepository.remove(refreshToken);
      throw new UnauthorizedException('Refresh token expired');
    }

    // Check if token was replaced (rotation detection)
    if (refreshToken.replacedBy) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Verify device fingerprint
    const deviceFingerprint = DeviceFingerprintUtil.createFingerprint(deviceFingerprintData);
    if (refreshToken.deviceFingerprint !== deviceFingerprint) {
      throw new UnauthorizedException('Device fingerprint mismatch');
    }

    const user = refreshToken.user;

    // Check if user is still active
    if (!user.isActive) {
      throw new ForbiddenException('User account is inactive');
    }

    // Rotate refresh token (invalidate old, create new)
    await this.refreshTokenRepository.remove(refreshToken);
    const newTokens = await this.generateTokens(user, deviceFingerprint);

    // Update session activity
    const session = await this.sessionRepository.findOne({
      where: { userId: user.id, deviceFingerprint },
    });
    if (session) {
      session.lastActivityAt = new Date();
      await this.sessionRepository.save(session);
    }

    const { password, emailVerificationToken, passwordResetToken, ...userResponse } = user;
    return {
      ...newTokens,
      user: userResponse as any,
    };
  }

  /**
   * Logout user
   */
  async logout(refreshToken: string, userId: string): Promise<void> {
    const refreshTokenHash = TokenUtil.hashToken(refreshToken);
    const token = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenHash, userId },
    });

    if (token) {
      await this.refreshTokenRepository.remove(token);
    }

    // Optionally remove session as well
    const sessions = await this.sessionRepository.find({ where: { userId } });
    if (sessions.length > 0) {
      // Remove the session matching the device fingerprint from the token
      const deviceFingerprint = token?.deviceFingerprint;
      if (deviceFingerprint) {
        const session = sessions.find((s) => s.deviceFingerprint === deviceFingerprint);
        if (session) {
          await this.sessionRepository.remove(session);
        }
      }
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<void> {
    const tokenHash = TokenUtil.hashToken(verifyEmailDto.token);
    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: tokenHash },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
      throw new BadRequestException('Verification token has expired');
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await this.userRepository.save(user);
  }

  /**
   * Forgot password
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<void> {
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);

    // Don't reveal if email exists (security best practice)
    if (!user) {
      return;
    }

    // Generate reset token
    const resetToken = TokenUtil.generateToken();
    const resetExpires = new Date();
    resetExpires.setHours(
      resetExpires.getHours() +
        parseInt(this.configService.get<string>('auth.passwordResetExpiration')?.replace('h', '') || '1', 10),
    );

    user.passwordResetToken = TokenUtil.hashToken(resetToken);
    user.passwordResetExpires = resetExpires;
    await this.userRepository.save(user);

    // Send reset email
    try {
      await this.emailService.sendPasswordResetEmail(user.email, resetToken);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
    }
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(user: User, deviceFingerprint: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('auth.jwtAccessExpiration') || '15m',
    } as any);

    // Generate refresh token
    const refreshTokenValue = TokenUtil.generateToken(64);
    const refreshTokenHash = TokenUtil.hashToken(refreshTokenValue);

    const refreshTokenExpires = new Date();
    const refreshExpiration = this.configService.get<string>('auth.jwtRefreshExpiration') || '7d';
    if (refreshExpiration.endsWith('d')) {
      refreshTokenExpires.setDate(refreshTokenExpires.getDate() + parseInt(refreshExpiration.replace('d', ''), 10));
    } else if (refreshExpiration.endsWith('h')) {
      refreshTokenExpires.setHours(refreshTokenExpires.getHours() + parseInt(refreshExpiration.replace('h', ''), 10));
    }

    // Save refresh token
    const refreshToken = this.refreshTokenRepository.create({
      token: refreshTokenHash,
      userId: user.id,
      deviceFingerprint,
      expiresAt: refreshTokenExpires,
    });
    await this.refreshTokenRepository.save(refreshToken);

    return {
      accessToken,
      refreshToken: refreshTokenValue,
    };
  }

  /**
   * Manage user sessions (enforce concurrent session limit)
   */
  private async manageSessions(
    userId: string,
    deviceFingerprint: string,
    deviceFingerprintData: DeviceFingerprintData,
  ): Promise<void> {
    const maxSessions = this.configService.get<number>('auth.maxConcurrentSessions') || 3;
    const existingSessions = await this.sessionRepository.find({
      where: { userId },
      order: { lastActivityAt: 'ASC' },
    });

    // Check if session already exists for this device
    const existingSession = existingSessions.find((s) => s.deviceFingerprint === deviceFingerprint);

    if (existingSession) {
      // Update existing session
      existingSession.lastActivityAt = new Date();
      existingSession.ipAddress = deviceFingerprintData.ipAddress;
      existingSession.userAgent = deviceFingerprintData.userAgent;
      await this.sessionRepository.save(existingSession);
    } else {
      // Create new session
      if (existingSessions.length >= maxSessions) {
        // Remove oldest session
        await this.sessionRepository.remove(existingSessions[0]);
      }

      // Create new session
      const newSession = this.sessionRepository.create({
        userId,
        deviceFingerprint,
        ipAddress: deviceFingerprintData.ipAddress,
        userAgent: deviceFingerprintData.userAgent,
        lastActivityAt: new Date(),
      });
      await this.sessionRepository.save(newSession);
    }
  }
}
