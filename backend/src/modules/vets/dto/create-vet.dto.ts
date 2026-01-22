import {
  IsString,
  IsEmail,
  IsArray,
  IsOptional,
} from 'class-validator';

export class CreateVetDto {
  @IsString()
  clinicName: string;

  @IsString()
  vetName: string;

  @IsString()
  licenseNumber: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @IsString()
  address: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  zipCode: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specializations?: string[];
}
