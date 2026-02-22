import {
  IsString,
  IsDateString,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { PrescriptionStatus } from '../entities/prescription.entity';

export class CreatePrescriptionDto {
  @IsUUID()
  petId: string;

  @IsUUID()
  vetId: string;

  @IsString()
  medication: string;

  @IsString()
  dosage: string;

  @IsString()
  frequency: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number; // Duration in days

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  instructions?: string; // Detailed medication instructions

  @IsOptional()
  @IsString()
  pharmacyInfo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  refillsRemaining?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(PrescriptionStatus)
  status?: PrescriptionStatus;
}
