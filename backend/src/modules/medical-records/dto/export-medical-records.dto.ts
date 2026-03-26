import {
  IsEnum,
  IsOptional,
  IsEmail,
  IsArray,
  IsUUID,
  IsDateString,
  IsBoolean,
  ArrayMinSize,
} from 'class-validator';
import { RecordType } from '../entities/medical-record.entity';

export enum ExportFormat {
  PDF = 'pdf',
  CSV = 'csv',
  FHIR = 'fhir',
}

/**
 * DTO for requesting a medical records export (download).
 * Use either recordIds for specific records or petId + optional date range for batch.
 */
export class ExportMedicalRecordsDto {
  @IsEnum(ExportFormat)
  format: ExportFormat;

  /** Export specific records by ID. If provided, petId/startDate/endDate are ignored. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1, { message: 'recordIds must contain at least one ID' })
  recordIds?: string[];

  /** Batch export: filter by pet. */
  @IsOptional()
  @IsUUID()
  petId?: string;

  /** Batch export: filter by record type. */
  @IsOptional()
  @IsEnum(RecordType)
  recordType?: RecordType;

  /** Batch export: start date (inclusive). */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** Batch export: end date (inclusive). */
  @IsOptional()
  @IsDateString()
  endDate?: string;

  /** Include attachment metadata/list in export (always true for FHIR). */
  @IsOptional()
  @IsBoolean()
  includeAttachments?: boolean;
}

/**
 * DTO for requesting an export to be sent by email.
 */
export class EmailExportMedicalRecordsDto extends ExportMedicalRecordsDto {
  /** Recipient email. If omitted, uses the authenticated user's email. */
  @IsOptional()
  @IsEmail()
  to?: string;

  /** Optional message included in the email body. */
  @IsOptional()
  message?: string;
}
