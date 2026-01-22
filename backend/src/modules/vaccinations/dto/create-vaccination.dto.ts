import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDate,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVaccinationDto {
  @IsUUID()
  @IsNotEmpty()
  petId: string;

  @IsString()
  @IsNotEmpty()
  vaccineName: string;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  administeredDate: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  expirationDate?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  nextDueDate?: Date;

  @IsString()
  @IsNotEmpty()
  veterinarianName: string;

  @IsUUID()
  @IsOptional()
  vetClinicId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
