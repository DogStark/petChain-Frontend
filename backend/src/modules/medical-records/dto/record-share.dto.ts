import {
  IsString,
  IsEnum,
  IsOptional,
  IsEmail,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { SharePermission } from '../entities/record-share.entity';

export class CreateRecordShareDto {
  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @IsOptional()
  @IsUUID()
  recipientUserId?: string;

  @IsOptional()
  @IsEnum(SharePermission)
  permission?: SharePermission = SharePermission.VIEW;

  /**
   * Time in hours until the share link expires.
   * Default: 168 (7 days), Max: 8760 (1 year)
   * Set to 0 or null for no expiration.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8760)
  expiresInHours?: number = 168;

  @IsOptional()
  @IsString()
  message?: string;
}

export class UpdateRecordShareDto {
  @IsOptional()
  @IsEnum(SharePermission)
  permission?: SharePermission;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ShareViaEmailDto {
  @IsEmail()
  recipientEmail: string;

  @IsOptional()
  @IsEnum(SharePermission)
  permission?: SharePermission = SharePermission.VIEW;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8760)
  expiresInHours?: number = 168;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  subject?: string;
}

export class ValidateShareTokenDto {
  @IsString()
  token: string;
}

export class RecordShareResponseDto {
  id: string;
  token: string;
  shareUrl: string;
  medicalRecordId: string;
  recipientEmail?: string;
  permission: SharePermission;
  expiresAt?: Date | null;
  createdAt: Date;
  isExpired: boolean;
  isRevoked: boolean;
  accessCount: number;
  lastAccessedAt?: Date;
}

export class ShareAccessLogDto {
  id: string;
  accessorEmail?: string;
  ipAddress?: string;
  action: string;
  accessedAt: Date;
  userAgent?: string;
}
