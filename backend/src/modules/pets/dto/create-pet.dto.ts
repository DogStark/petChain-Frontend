import {
<<<<<<< HEAD
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
=======
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
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
}
