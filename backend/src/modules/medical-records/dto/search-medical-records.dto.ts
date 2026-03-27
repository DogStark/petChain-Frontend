import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { RecordType, AccessLevel } from '../entities/medical-record.entity';

export class SearchMedicalRecordsDto {
  @IsOptional()
  @IsUUID()
  petId?: string;

  @IsOptional()
  @IsEnum(RecordType)
  recordType?: RecordType;

  @IsOptional()
  @IsEnum(AccessLevel)
  accessLevel?: AccessLevel;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  /** Full-text search across diagnosis, treatment, notes */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  vetId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  verified?: boolean;
}
