import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  IsObject,
  IsUrl,
  Length,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SpeciesType, SizeCategory } from '../entities/breed.entity';

class LifeExpectancyDto {
  @IsOptional()
  min?: number;

  @IsOptional()
  max?: number;

  @IsOptional()
  average?: number;
}

class CareRequirementsDto {
  @IsOptional()
  @IsEnum(['low', 'moderate', 'high'])
  exercise_level?: 'low' | 'moderate' | 'high';

  @IsOptional()
  @IsEnum(['minimal', 'moderate', 'high'])
  grooming_needs?: 'minimal' | 'moderate' | 'high';

  @IsOptional()
  @IsEnum(['easy', 'moderate', 'challenging'])
  training_difficulty?: 'easy' | 'moderate' | 'challenging';

  @IsOptional()
  @IsBoolean()
  good_with_kids?: boolean;

  @IsOptional()
  @IsBoolean()
  good_with_pets?: boolean;

  @IsOptional()
  @IsBoolean()
  apartment_friendly?: boolean;
}

class VaccinationScheduleDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  core_vaccines?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recommended_vaccines?: string[];

  @IsOptional()
  @IsString()
  schedule_notes?: string;
}

class PhysicalCharacteristicsDto {
  @IsOptional()
  @IsObject()
  weight_range?: { min: number; max: number; unit: 'lbs' | 'kg' };

  @IsOptional()
  @IsObject()
  height_range?: { min: number; max: number; unit: 'inches' | 'cm' };

  @IsOptional()
  @IsString()
  coat_type?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  colors?: string[];
}

class BreedGroupDto {
  @IsOptional()
  @IsString()
  akc_group?: string;

  @IsOptional()
  @IsString()
  cfa_group?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  purpose?: string[];
}

export class CreateBreedDto {
  @IsEnum(SpeciesType)
  species: SpeciesType;

  @IsString()
  @Length(1, 100)
  name: string;

  @IsEnum(SizeCategory)
  size_category: SizeCategory;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  temperament: string[];

  @IsArray()
  @IsString({ each: true })
  common_health_issues: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => LifeExpectancyDto)
  life_expectancy?: LifeExpectancyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CareRequirementsDto)
  care_requirements?: CareRequirementsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => VaccinationScheduleDto)
  vaccination_schedule?: VaccinationScheduleDto;

  @IsOptional()
  @IsUrl()
  image_url?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  origin_country?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PhysicalCharacteristicsDto)
  physical_characteristics?: PhysicalCharacteristicsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BreedGroupDto)
  breed_group?: BreedGroupDto;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}