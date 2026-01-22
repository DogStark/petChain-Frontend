import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { PetSpecies } from '../entities/pet.entity';

export class CreateBreedDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(PetSpecies)
  @IsNotEmpty()
  species: PetSpecies;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  averageLifespan?: number;

  @IsString()
  @IsOptional()
  averageWeight?: string;

  @IsString()
  @IsOptional()
  size?: string;
}
