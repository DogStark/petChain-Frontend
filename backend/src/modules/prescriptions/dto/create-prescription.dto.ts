import {
  IsString,
  IsDateString,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
} from 'class-validator';

export class CreatePrescriptionDto {
  @IsUUID()
  petId: string;

  @IsString()
  medication: string;

  @IsString()
  dosage: string;

  @IsString()
  frequency: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsUUID()
  prescribedBy?: string;

  @IsOptional()
  @IsString()
  pharmacyInfo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  refillsRemaining?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
