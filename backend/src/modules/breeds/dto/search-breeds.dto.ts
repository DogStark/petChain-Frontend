import {
  IsOptional,
  IsEnum,
  IsString,
  IsArray,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { SpeciesType, SizeCategory } from '../entities/breed.entity';

export class SearchBreedsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(SpeciesType)
  species?: SpeciesType;

  @IsOptional()
  @IsEnum(SizeCategory)
  size_category?: SizeCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => Array.isArray(value) ? value : value.split(','))
  temperament?: string[];

  @IsOptional()
  @IsString()
  origin_country?: string;

  @IsOptional()
  @IsString()
  akc_group?: string;

  @IsOptional()
  @IsString()
  cfa_group?: string;

  @IsOptional()
  @IsEnum(['low', 'moderate', 'high'])
  exercise_level?: 'low' | 'moderate' | 'high';

  @IsOptional()
  @IsEnum(['minimal', 'moderate', 'high'])
  grooming_needs?: 'minimal' | 'moderate' | 'high';

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  good_with_kids?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  good_with_pets?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  apartment_friendly?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Min(1)
  @Max(30)
  min_life_expectancy?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Min(1)
  @Max(30)
  max_life_expectancy?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Min(1)
  @Max(1000)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(['name', 'species', 'size_category', 'created_at'])
  sort_by?: string = 'name';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sort_order?: 'ASC' | 'DESC' = 'ASC';
}