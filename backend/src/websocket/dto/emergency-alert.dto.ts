import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum EmergencyType {
  MEDICAL = 'MEDICAL',
  LOST_PET = 'LOST_PET',
  ACCIDENT = 'ACCIDENT',
  CRITICAL_HEALTH = 'CRITICAL_HEALTH',
}

export class EmergencyAlertDto {
  @IsEnum(EmergencyType)
  type: EmergencyType;

  @IsString()
  @IsNotEmpty()
  petId: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  contactNumber?: string;
}
