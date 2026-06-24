import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  IsInt,
  IsEnum,
  IsIn,
  IsDateString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PetSpecies } from '../../pets/entities/pet-species.enum';
import { PetGender } from '../../pets/entities/pet-gender.enum';
import { RecordType } from '../../medical-records/entities/medical-record.entity';

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  query?: string;

  @IsOptional()
  @IsString()
  @IsIn(['pets', 'vets', 'medical-records', 'emergency-services', 'global'])
  type?: string;

  // Pagination
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  // Pet filters
  @IsOptional()
  @IsString()
  breed?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minAge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxAge?: number;

  @IsOptional()
  @IsEnum(PetSpecies)
  species?: PetSpecies;

  @IsOptional()
  @IsEnum(PetGender)
  gender?: PetGender;

  // Vet filters
  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsString()
  location?: string;

  // Medical record filters
  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsString()
  treatment?: string;

  @IsOptional()
  @IsEnum(RecordType)
  recordType?: RecordType;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  // Geospatial
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  radius?: number;

  // Sorting
  @IsOptional()
  @IsIn(['relevance', 'name', 'createdAt', 'visitDate', 'distance'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';

  // Backward-compatible fields
  @IsOptional()
  @IsString()
  serviceType?: string;

  @IsOptional()
  @IsBoolean()
  is24Hours?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  // Misc
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeInactive?: boolean;
}
