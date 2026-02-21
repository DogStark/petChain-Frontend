import { IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';

export class UpdateUserLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @IsBoolean()
  receiveLostPetAlerts?: boolean;
}
