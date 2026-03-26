import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { AllergySeverity } from '../entities/allergy.entity';

export class CreateAllergyDto {
  @IsUUID()
  petId: string;

  @IsString()
  allergen: string;

  @IsEnum(AllergySeverity)
  severity: AllergySeverity;

  @IsOptional()
  @IsString()
  reactionNotes?: string;

  @IsDateString()
  discoveredDate: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  testingResults?: string;

  @IsOptional()
  @IsDateString()
  testingDate?: string;

  @IsOptional()
  @IsString()
  testedBy?: string;

  @IsOptional()
  @IsBoolean()
  alertVeterinarian?: boolean;
}
