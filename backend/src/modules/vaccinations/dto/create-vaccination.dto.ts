import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDate,
  IsUUID,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateAdverseReactionDto } from './create-adverse-reaction.dto';

export class CreateVaccinationDto {
  @IsUUID()
  @IsNotEmpty()
  petId: string;

  @IsUUID()
  @IsOptional()
  vetId?: string;

  @IsString()
  @IsNotEmpty()
  vaccineName: string;

  @IsString()
  @IsOptional()
  manufacturer?: string;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  administeredDate: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  expirationDate?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  nextDueDate?: Date;

  @IsString()
  @IsOptional()
  veterinarianName?: string;

  @IsUUID()
  @IsOptional()
  vetClinicId?: string;

  @IsString()
  @IsOptional()
  site?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAdverseReactionDto)
  @IsOptional()
  adverseReactions?: CreateAdverseReactionDto[];
}
