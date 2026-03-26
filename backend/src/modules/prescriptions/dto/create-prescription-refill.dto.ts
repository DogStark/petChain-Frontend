import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';

export class CreatePrescriptionRefillDto {
  @IsUUID()
  prescriptionId: string;

  @IsDateString()
  refillDate: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  pharmacyName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
