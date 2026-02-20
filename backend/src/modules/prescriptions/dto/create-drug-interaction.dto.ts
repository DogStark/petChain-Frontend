import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { InteractionSeverity } from '../entities/drug-interaction.entity';

export class CreateDrugInteractionDto {
  @IsUUID()
  medicationId1: string;

  @IsUUID()
  medicationId2: string;

  @IsEnum(InteractionSeverity)
  severity: InteractionSeverity;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  mechanism?: string;

  @IsOptional()
  @IsString()
  managementStrategies?: string;

  @IsOptional()
  @IsString()
  symptoms?: string;
}
