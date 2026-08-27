import { IsNumber, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

export class CreateSightingDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  photoUrl?: string;
}
