import {
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
  notes?: string;
}
