import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class ReportFoundPetDto {
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  foundLatitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  foundLongitude?: number;

  @IsOptional()
  @IsString()
  foundLocation?: string;

  @IsOptional()
  @IsString()
  foundDetails?: string;
}
