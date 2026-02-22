import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import {
  ConditionStatus,
  ConditionSeverity,
} from '../entities/condition.entity';

export class CreateConditionDto {
  @IsUUID()
  petId: string;

  @IsString()
  conditionName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ConditionStatus)
  status?: ConditionStatus;

  @IsOptional()
  @IsEnum(ConditionSeverity)
  severity?: ConditionSeverity;

  @IsDateString()
  diagnosedDate: string;

  @IsOptional()
  @IsString()
  treatment?: string;

  @IsOptional()
  @IsString()
  medications?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  veterinarianName?: string;

  @IsOptional()
  @IsString()
  clinicName?: string;

  @IsOptional()
  @IsDateString()
  lastCheckupDate?: string;

  @IsOptional()
  @IsDateString()
  nextCheckupDate?: string;

  @IsOptional()
  @IsBoolean()
  requiresOngoingCare?: boolean;

  @IsOptional()
  @IsBoolean()
  isChronicCondition?: boolean;
}
