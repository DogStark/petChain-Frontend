import {
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateQRCodeDto {
  @IsString()
  @IsNotEmpty()
  petId: string;

  @IsString()
  @IsOptional()
  emergencyContact?: string;

  @IsString()
  @IsOptional()
  customMessage?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class BatchCreateQRCodeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQRCodeDto)
  qrcodes: CreateQRCodeDto[];
}
