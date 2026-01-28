import {
<<<<<<< HEAD
  IsString,
  IsDateString,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateVaccinationDto {
  @IsUUID()
  petId: string;

  @IsString()
  vaccineName: string;

  @IsDateString()
  dateAdministered: string;

  @IsDateString()
  nextDueDate: string;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsUUID()
  administeredBy?: string;

  @IsOptional()
  @IsString()
=======
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
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
  notes?: string;
}
