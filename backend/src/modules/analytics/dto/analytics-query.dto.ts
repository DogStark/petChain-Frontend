import {
  IsBooleanString,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
}

export enum AnalyticsGroupBy {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export enum AnalyticsMetric {
  PET_HEALTH = 'pet_health',
  VACCINATION_COMPLIANCE = 'vaccination_compliance',
  SYSTEM_USAGE = 'system_usage',
  USER_OVERVIEW = 'user_overview',
  PET_REGISTRATIONS = 'pet_registrations',
  APPOINTMENT_OVERVIEW = 'appointment_overview',
}

export class AnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat;

  @IsOptional()
  @IsEnum(AnalyticsGroupBy)
  groupBy?: AnalyticsGroupBy;

  @IsOptional()
  @IsString()
  metrics?: string;

  @IsOptional()
  @IsString()
  reportName?: string;

  @IsOptional()
  @IsUUID()
  petId?: string;

  @IsOptional()
  @IsBooleanString()
  fresh?: string;
}
