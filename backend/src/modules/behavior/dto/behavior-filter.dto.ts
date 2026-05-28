import {
  IsUUID,
  IsEnum,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BehaviorType, BehaviorSeverity } from './create-behavior-log.dto';

export enum BehaviorSortField {
  OBSERVED_AT = 'observedAt',
  CREATED_AT = 'createdAt',
  SEVERITY = 'severity',
  INTENSITY = 'intensity',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

/**
 * DTO for filtering and paginating behavior log entries.
 *
 * All fields are optional; omitting them returns all records (subject to
 * default pagination limits).
 *
 * @example
 * // Filter by pet, type, and date range with pagination
 * {
 *   "petId": "550e8400-e29b-41d4-a716-446655440000",
 *   "behaviorType": "aggression",
 *   "startDate": "2026-01-01",
 *   "endDate": "2026-05-31",
 *   "severity": "high",
 *   "page": 1,
 *   "limit": 20,
 *   "sortBy": "observedAt",
 *   "order": "DESC"
 * }
 */
export class BehaviorFilterDto {
  /** Filter logs for a specific pet. */
  @IsOptional()
  @IsUUID()
  petId?: string;

  /** Filter by behavior category. */
  @IsOptional()
  @IsEnum(BehaviorType)
  behaviorType?: BehaviorType;

  /** Filter by severity level. */
  @IsOptional()
  @IsEnum(BehaviorSeverity)
  severity?: BehaviorSeverity;

  /**
   * Return only logs observed on or after this ISO-8601 date/datetime.
   * Can be combined with endDate for a date range query.
   */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /**
   * Return only logs observed on or before this ISO-8601 date/datetime.
   * Can be combined with startDate for a date range query.
   */
  @IsOptional()
  @IsDateString()
  endDate?: string;

  /** Page number (1-based). Defaults to 1. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** Number of records per page. Defaults to 20, max 100. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /** Field to sort results by. Defaults to observedAt. */
  @IsOptional()
  @IsEnum(BehaviorSortField)
  sortBy?: BehaviorSortField = BehaviorSortField.OBSERVED_AT;

  /** Sort direction. Defaults to DESC (most recent first). */
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder = SortOrder.DESC;
}
