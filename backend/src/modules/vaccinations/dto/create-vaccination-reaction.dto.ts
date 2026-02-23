import { IsNotEmpty, IsString, IsOptional, IsInt, IsBoolean, IsEnum } from 'class-validator';

export class CreateVaccinationReactionDto {
  @IsNotEmpty()
  @IsEnum(['MILD', 'MODERATE', 'SEVERE'])
  severity: 'MILD' | 'MODERATE' | 'SEVERE';

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsInt()
  @IsOptional()
  onsetHours?: number;

  @IsInt()
  @IsOptional()
  durationHours?: number;

  @IsString()
  @IsOptional()
  treatment?: string;

  @IsBoolean()
  @IsOptional()
  requiredVeterinaryIntervention?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  reportedToManufacturer?: boolean;

  @IsString()
  @IsOptional()
  manufacturerReportId?: string;
}
