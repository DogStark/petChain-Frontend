import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class LocationUpdateDto {
  @IsString()
  petId: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsNumber()
  @IsOptional()
  accuracy?: number;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsOptional()
  batteryLevel?: number;
}
