import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsEmail,
  IsUrl,
  IsObject,
  IsArray,
} from 'class-validator';

export class CreateVetClinicDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  zipCode?: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsUrl()
  @IsOptional()
  website?: string;

  @IsObject()
  @IsOptional()
  operatingHours?: Record<string, { open: string; close: string }>;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  services?: string[];

  @IsBoolean()
  @IsOptional()
  acceptsWalkIns?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
