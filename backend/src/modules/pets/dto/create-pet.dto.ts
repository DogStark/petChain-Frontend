import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDate,
  IsNumber,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PetSpecies } from '../entities/pet.entity';

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

  @IsNumber()
  @IsOptional()
  weight?: number;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  microchipNumber?: string;

  @IsUUID()
  @IsOptional()
  ownerId?: string;
}
