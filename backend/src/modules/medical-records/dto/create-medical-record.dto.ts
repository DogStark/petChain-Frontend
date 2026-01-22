import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsUUID,
  IsArray,
} from 'class-validator';
import { RecordType } from '../entities/medical-record.entity';

export class CreateMedicalRecordDto {
  @IsUUID()
  petId: string;

  @IsOptional()
  @IsUUID()
  vetId?: string;

  @IsEnum(RecordType)
  recordType: RecordType;

  @IsDateString()
  date: string;

  @IsString()
  diagnosis: string;

  @IsString()
  treatment: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
