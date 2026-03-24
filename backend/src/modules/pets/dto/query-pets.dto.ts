import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PetGender } from '../entities/pet-gender.enum';
import { PetSpecies } from '../entities/pet-species.enum';

export class QueryPetsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @IsEnum(PetSpecies)
  @IsOptional()
  species?: PetSpecies;

  @IsEnum(PetGender)
  @IsOptional()
  gender?: PetGender;

  @IsUUID()
  @IsOptional()
  breedId?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsBooleanString()
  @IsOptional()
  includeDeleted?: string;

  @IsBooleanString()
  @IsOptional()
  neutered?: string;
}
