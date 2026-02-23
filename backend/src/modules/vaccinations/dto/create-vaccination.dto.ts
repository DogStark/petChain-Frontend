import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
} from 'class-validator';

export class CreateVaccinationDto {
  @IsUUID()
  @IsNotEmpty()
  petId: string;

  @IsString()
  @IsNotEmpty()
  vaccineName: string;

  @IsString()
  @IsOptional()
  manufacturer?: string;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsDateString()
  @IsNotEmpty()
  dateAdministered: string;

  @IsDateString()
  @IsOptional()
  nextDueDate?: string;

  @IsDateString()
  @IsOptional()
  expirationDate?: string;

  @IsString()
  @IsNotEmpty()
  veterinarianName: string;

  @IsUUID()
  @IsOptional()
  vetClinicId?: string;

  @IsString()
  @IsOptional()
  site?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

  @IsString()
  @IsOptional()
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
  notes?: string;
}
