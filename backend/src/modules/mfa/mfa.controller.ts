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

@Controller('mfa')
@UseGuards(JwtAuthGuard)
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

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
