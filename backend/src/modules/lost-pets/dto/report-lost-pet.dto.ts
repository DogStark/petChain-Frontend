import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

export class ReportLostPetDto {
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lastSeenLatitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lastSeenLongitude?: number;

  @IsOptional()
  @IsDateString()
  lastSeenDate?: string;

  @IsOptional()
  @IsString()
  customMessage?: string;

  @IsOptional()
  @IsString()
  contactInfo?: string;
}
