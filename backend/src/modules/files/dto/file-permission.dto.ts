import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDate,
  MaxLength,
} from 'class-validator';
import { PermissionType, AccessLevel } from '../entities/file-permission.entity';
import { Type } from 'class-transformer';

/**
 * DTO for sharing file with a user
 */
export class ShareFileDto {
  /**
   * User ID to share file with
   * Optional if accessLevel is PUBLIC or LINK
   */
  @IsOptional()
  @IsUUID()
  userId?: string;

  /**
   * Permission level for the recipient
   */
  @IsEnum(PermissionType)
  permissionType: PermissionType;

  /**
   * Access level for the file
   */
  @IsEnum(AccessLevel)
  accessLevel: AccessLevel;

  /**
   * Optional expiration date for the permission
   */
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;

  /**
   * Optional notes about the sharing
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/**
 * DTO for updating file permission
 */
export class UpdateFilePermissionDto {
  /**
   * New permission level
   */
  @IsOptional()
  @IsEnum(PermissionType)
  permissionType?: PermissionType;

  /**
   * New access level
   */
  @IsOptional()
  @IsEnum(AccessLevel)
  accessLevel?: AccessLevel;

  /**
   * New expiration date
   */
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date | null;

  /**
   * Whether permission is active
   */
  @IsOptional()
  isActive?: boolean;

  /**
   * Updated notes
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/**
 * DTO for generating a shareable link
 */
export class GenerateShareLinkDto {
  /**
   * Permission level for the link
   */
  @IsEnum(PermissionType)
  permissionType: PermissionType;

  /**
   * Optional expiration date for the link
   */
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;
}

/**
 * Response DTO for permission
 */
export class FilePermissionResponseDto {
  id: string;
  fileId: string;
  userId: string | null;
  userName?: string;
  permissionType: PermissionType;
  accessLevel: AccessLevel;
  shareToken?: string;
  sharedBy: string;
  expiresAt: Date | null;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date | null;
}

/**
 * Response DTO for shareable link
 */
export class ShareLinkResponseDto {
  shareToken: string;
  fileId: string;
  permissionType: PermissionType;
  expiresAt: Date | null;
  createdAt: Date;
  shareUrl: string;
}

/**
 * DTO for accessing file via share token
 */
export class AccessViaShareTokenDto {
  /**
   * Share token from the link
   */
  @IsString()
  shareToken: string;
}
