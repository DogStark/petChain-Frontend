import { IsEnum, IsBoolean, IsOptional, IsString } from 'class-validator';
import { ConsentType } from '../entities/user-consent.entity';

export class UpdateConsentDto {
  @IsEnum(ConsentType)
  type: ConsentType;

  @IsBoolean()
  granted: boolean;
}

export class RequestDeletionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
