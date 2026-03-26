import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
} from 'class-validator';
import { PetSpecies } from '../entities/pet-species.enum';

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

  @IsString()
  @IsOptional()
  lifeExpectancy?: string;

  @IsString()
  @IsOptional()
  averageWeight?: string;

  @IsString()
  @IsOptional()
  sizeCategory?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  commonHealthIssues?: string[];

  @IsString()
  @IsOptional()
  careRequirements?: string;
}
