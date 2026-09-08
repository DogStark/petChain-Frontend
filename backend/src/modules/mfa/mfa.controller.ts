import { Controller, Post, Body, UseGuards, Param } from '@nestjs/common';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { MfaService } from './mfa.service';
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { MfaService } from './mfa.service';
import { VerifyTotpDto, VerifyBackupCodeDto } from './dto/mfa.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

class SetupTotpDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}

class VerifyBackupCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}

@Controller('mfa')
@UseGuards(JwtAuthGuard)
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Post('totp/setup')
  async setupTotp(@CurrentUser() user: User) {
    const { secret, record } = await this.mfaService.setupTotp(user.id);
    return {
      recordId: record.id,
      secret,
      message: 'Scan this secret with your authenticator app, then verify with the 6-digit code',
    };
  }

  @Post('totp/:recordId/verify')
  async verifyTotp(
    @Param('recordId') recordId: string,
    @CurrentUser() user: User,
    @Body() dto: SetupTotpDto,
  ) {
    const record = await this.mfaService.verifyAndEnableTotp(
      recordId,
      user.id,
      dto.code,
    );
    return { message: 'TOTP verified and enabled', verified: record.verified };
  }

  @Post('backup-codes/setup')
  async setupBackupCodes(@CurrentUser() user: User) {
    const { codes, record } = await this.mfaService.setupBackupCodes(user.id);
    return {
      recordId: record.id,
      codes,
      message: 'Save these backup codes in a secure location',
    };
  }

  @Post('backup-code/:recordId/verify')
  async verifyBackupCode(
    @Param('recordId') recordId: string,
    @CurrentUser() user: User,
    @Body() dto: VerifyBackupCodeDto,
  ) {
    const success = await this.mfaService.consumeBackupCode(
      recordId,
      user.id,
      dto.code,
    );
    if (!success) {
      return { message: 'Invalid or already used backup code', success: false };
    }
    return { message: 'Backup code verified', success: true };
  }

  @Post('disable/:recordId')
  async disableMfa(
    @Param('recordId') recordId: string,
    @CurrentUser() user: User,
  ) {
    await this.mfaService.disableMfa(recordId, user.id);
    return { message: 'MFA disabled' };
  /** GET /mfa/status — check if MFA is enabled and backup codes remaining */
  @Get('status')
  getStatus(@CurrentUser() user: User) {
    return this.mfaService.getMfaStatus(user.id);
  }

  /** POST /mfa/setup — generate TOTP secret and QR code */
  @Post('setup')
  @HttpCode(HttpStatus.OK)
  setup(@CurrentUser() user: User) {
    return this.mfaService.setupMfa(user.id);
  }

  /** POST /mfa/enable — verify TOTP and activate MFA, returns backup codes */
  @Post('enable')
  @HttpCode(HttpStatus.OK)
  enable(@CurrentUser() user: User, @Body() dto: VerifyTotpDto) {
    return this.mfaService.enableMfa(user.id, dto.token);
  }

  /** POST /mfa/verify — verify a TOTP token */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@CurrentUser() user: User, @Body() dto: VerifyTotpDto) {
    const valid = await this.mfaService.verifyTotp(user.id, dto.token);
    return { valid };
  }

  /** POST /mfa/verify-backup — verify and consume a backup code */
  @Post('verify-backup')
  @HttpCode(HttpStatus.OK)
  async verifyBackup(@CurrentUser() user: User, @Body() dto: VerifyBackupCodeDto) {
    const valid = await this.mfaService.verifyBackupCode(user.id, dto.code);
    return { valid };
  }

  /** POST /mfa/backup-codes/regenerate — regenerate backup codes (requires TOTP) */
  @Post('backup-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  regenerateBackupCodes(@CurrentUser() user: User, @Body() dto: VerifyTotpDto) {
    return this.mfaService.regenerateBackupCodes(user.id, dto.token);
  }

  /** DELETE /mfa/disable — disable MFA (requires TOTP confirmation) */
  @Delete('disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disable(@CurrentUser() user: User, @Body() dto: VerifyTotpDto): Promise<void> {
    await this.mfaService.disableMfa(user.id, dto.token);
  }
}
