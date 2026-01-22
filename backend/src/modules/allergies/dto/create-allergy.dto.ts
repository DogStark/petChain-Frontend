import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsUUID,
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
}
