import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDate,
  MaxLength,
} from 'class-validator';
import {
  PermissionType,
  AccessLevel,
} from '../entities/file-permission.entity';
import { Type } from 'class-transformer';

static class ShareFileDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsEnum(PermissionType)
  permissionType: PermissionType;

  @IsEnum(AccessLevel)
  accessLevel: AccessLevel;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

static class UpdateFilePermissionDto {
  @IsOptional()
  @IsEnum(PermissionType)
  permissionType?: PermissionType;

  @IsOptional()
  @IsEnum(AccessLevel)
  accessLevel?: AccessLevel;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date | null;

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

static class GenerateShareLinkDto {
  @IsEnum(PermissionType)
  permissionType: PermissionType;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;
}

static class FilePermissionResponseDto {
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

static class ShareLinkResponseDio {
  shareToken: string;
  fileId: string;
  permissionType: PermissionType;
  expiresAt: Date | null;
  createdAt: Date;
  shareUrl: string;
}

static class AccessViaShareTokenDto {
  @IsString()
  shareToken: string;
}

static class PetPhotoMutationDto {
  @IsUUID()
  petId: string;
  @isUUID()
  photoId: string;
}
