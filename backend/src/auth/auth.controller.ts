import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshDto,
  LogoutDto,
  VerifyEmailDto,
  ResendVerificationDto,
  VerifyPhoneDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../modules/users/entities/user.entity';
import { DeviceFingerprintUtil } from './utils/device-fingerprint.util';

@Throttle({ default: { limit: 5, ttl: 60000 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const deviceFingerprintData = DeviceFingerprintUtil.extractFromRequest(req);
    return this.authService.login(loginDto, deviceFingerprintData);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshDto: RefreshDto, @Req() req: Request) {
    const deviceFingerprintData = DeviceFingerprintUtil.extractFromRequest(req);
    return this.authService.refresh(refreshDto, deviceFingerprintData);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Body() logoutDto: LogoutDto, @CurrentUser() user: User) {
    await this.authService.logout(logoutDto.refreshToken, user.id);
    return { message: 'Logged out successfully' };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post('resend-email-verification')
  @HttpCode(HttpStatus.OK)
  async resendEmailVerification(
    @Body() resendVerificationDto: ResendVerificationDto,
  ) {
    await this.authService.resendEmailVerification(resendVerificationDto);
    return { message: 'If the account exists, a new verification email was sent' };
  }

  @Post('verify-phone')
  @HttpCode(HttpStatus.OK)
  async verifyPhone(@Body() verifyPhoneDto: VerifyPhoneDto) {
    return this.authService.verifyPhone(verifyPhoneDto);
  }

  @Post('resend-phone-verification')
  @HttpCode(HttpStatus.OK)
  async resendPhoneVerification(
    @Body() resendVerificationDto: ResendVerificationDto,
  ) {
    await this.authService.resendPhoneVerification(resendVerificationDto);
    return { message: 'If the account exists, a new verification code was sent' };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    await this.authService.forgotPassword(forgotPasswordDto);
    return {
      message: 'If the email exists, a password reset link has been sent',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    await this.authService.resetPassword(resetPasswordDto);
    return { message: 'Password reset successfully' };
  }
}