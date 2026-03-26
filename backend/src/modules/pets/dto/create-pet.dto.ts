import {
  IsString,
  IsEnum,
  IsOptional,
  IsDate,
  IsNumber,
  IsUUID,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PetGender } from '../entities/pet-gender.enum';
import { PetSpecies } from '../entities/pet-species.enum';

export class CreatePetDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(PetSpecies)
  @IsNotEmpty()
  species: PetSpecies;

  @IsUUID()
  @IsOptional()
  breedId?: string;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  dateOfBirth: Date;

  @IsEnum(PetGender)
  @IsOptional()
  gender?: PetGender;

  @IsString()
  @IsOptional()
  microchipNumber?: string;

  // Backward-compatible alias for microchipNumber
  @IsString()
  @IsOptional()
  microchipId?: string;

  @IsString()
  @IsOptional()
  tagId?: string;

  @IsNumber()
  @IsOptional()
  weight?: number;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  specialNeeds?: string;

  @IsString()
  @IsOptional()
  insurancePolicy?: string;

  @IsString()
  @IsOptional()
  behaviorNotes?: string;

  @IsBoolean()
  @IsOptional()
  neutered?: boolean;
}
