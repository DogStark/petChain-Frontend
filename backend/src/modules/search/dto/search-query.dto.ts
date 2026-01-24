import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  Min,
  Max,
  IsIn,
} from 'class-validator';

export class SearchQueryDto {
  @IsString()
  @IsOptional()
  query?: string;

  @IsString()
  @IsOptional()
  @IsIn(['pets', 'vets', 'medical-records', 'emergency-services', 'global'])
  type?: string;

  // Pagination
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number;

  // Filters
  @IsString()
  @IsOptional()
  breed?: string;

  @IsNumber()
  @IsOptional()
  minAge?: number;

  @IsNumber()
  @IsOptional()
  maxAge?: number;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  specialty?: string;

  @IsString()
  @IsOptional()
  condition?: string;

  @IsString()
  @IsOptional()
  treatment?: string;

  @IsString()
  @IsOptional()
  serviceType?: string;

  @IsBoolean()
  @IsOptional()
  is24Hours?: boolean;

  // Geolocation
  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  radius?: number; // in kilometers

  // Sorting
  @IsString()
  @IsOptional()
  @IsIn(['relevance', 'date', 'distance', 'rating', 'name'])
  sortBy?: string;

  @IsString()
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: string;

  // Additional filters
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsBoolean()
  @IsOptional()
  includeInactive?: boolean;
}
