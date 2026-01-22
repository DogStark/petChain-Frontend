import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsNumber,
  IsUUID,
} from 'class-validator';
import { PetGender, PetSpecies } from '../entities/pet.entity';

export class CreatePetDto {
  @IsUUID()
  ownerId: string;

  @IsString()
  name: string;

  @IsEnum(PetSpecies)
  species: PetSpecies;

  @IsOptional()
  @IsString()
  breed?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsEnum(PetGender)
  @IsOptional()
  gender?: PetGender;

  @IsOptional()
  @IsString()
  microchipNumber?: string;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  specialNeeds?: string;

  @IsOptional()
  @IsString()
  profilePhoto?: string;
}
