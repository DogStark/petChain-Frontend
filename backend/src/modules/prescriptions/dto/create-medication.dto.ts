import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { MedicationType } from '../entities/medication.entity';

export class CreateMedicationDto {
  @IsString()
  name: string;

  @IsString()
  genericName: string;

  @IsOptional()
  @IsString()
  brandNames?: string;

  @IsOptional()
  @IsEnum(MedicationType)
  type?: MedicationType;

  @IsString()
  activeIngredient: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sideEffects?: string;

  @IsOptional()
  @IsString()
  contraindications?: string;

  @IsOptional()
  @IsString()
  warnings?: string;

  @IsOptional()
  @IsString()
  precautions?: string;

  @IsOptional()
  @IsString()
  dosageUnits?: string;

  @IsOptional()
  @IsString()
  typicalDosageRange?: string;

  @IsOptional()
  @IsString()
  maxDailyDose?: string;

  @IsOptional()
  @IsString()
  petSpecificInfo?: string;

  @IsOptional()
  @IsString()
  foodInteractions?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  storageInstructions?: string;
}
