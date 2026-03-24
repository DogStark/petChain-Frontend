import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Timeline event types that can be filtered
 */
export enum TimelineEventType {
  VACCINATION = 'vaccination',
  MEDICAL_RECORD = 'medical_record',
  PRESCRIPTION = 'prescription',
  APPOINTMENT = 'appointment',
  ALLERGY = 'allergy',
  ALL = 'all',
}

/**
 * Sort order for timeline events
 */
export enum TimelineSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * Query parameters for fetching pet timeline
 */
export class GetTimelineQueryDto {
  @IsOptional()
  @IsEnum(TimelineEventType)
  eventType?: TimelineEventType = TimelineEventType.ALL;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(TimelineSortOrder)
  sortOrder?: TimelineSortOrder = TimelineSortOrder.DESC;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

/**
 * Export format options
 */
export enum TimelineExportFormat {
  PDF = 'pdf',
  JSON = 'json',
}

/**
 * Query parameters for exporting timeline
 */
export class ExportTimelineQueryDto extends GetTimelineQueryDto {
  @IsOptional()
  @IsEnum(TimelineExportFormat)
  format?: TimelineExportFormat = TimelineExportFormat.PDF;
}

/**
 * Individual timeline event response
 */
export class TimelineEventDto {
  id: string;
  type: TimelineEventType;
  title: string;
  description: string;
  date: Date;
  metadata: Record<string, any>;
  icon?: string;
  severity?: string;
}

/**
 * Full timeline response with pagination
 */
export class PetTimelineResponseDto {
  petId: string;
  petName: string;
  totalEvents: number;
  events: TimelineEventDto[];
  filters: {
    eventType: TimelineEventType;
    startDate?: string;
    endDate?: string;
  };
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Timeline share request
 */
export class ShareTimelineDto {
  @IsOptional()
  @IsString()
  recipientEmail?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8760)
  expiresInHours?: number = 168;

  @IsOptional()
  @IsEnum(TimelineEventType)
  eventType?: TimelineEventType = TimelineEventType.ALL;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
