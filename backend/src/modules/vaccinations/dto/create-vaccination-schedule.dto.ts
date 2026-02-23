import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateVaccinationScheduleDto {
  @IsUUID()
  @IsOptional()
  breedId?: string;

  @IsString()
  @IsNotEmpty()
  vaccineName: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  recommendedAgeWeeks: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  intervalWeeks?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  dosesRequired?: number;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsNumber()
  @IsOptional()
  priority?: number;
}
