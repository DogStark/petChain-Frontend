import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  IsEmail,
  Min,
  Max,
  IsIn,
  IsUrl,
} from 'class-validator';

export class CreateEmergencyServiceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  serviceType: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  services?: string[];

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  emergencyPhone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  is24Hours?: boolean;

  @IsOptional()
  operatingHours?: Record<string, any>;

  @IsString()
  @IsOptional()
  @IsIn(['available', 'busy', 'closed'])
  status?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  acceptedInsurance?: string[];

  @IsUrl()
  @IsOptional()
  website?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  specializations?: string[];
}
