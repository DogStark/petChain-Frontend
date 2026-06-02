import {
  IsOptional,
  IsUUID,
  IsString,
  IsEnum,
  IsDateString,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuditAction } from '../entities/audit-log.entity';

export class AuditQueryDto {
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsEnum(AuditAction) action?: AuditAction;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @IsIn(['ASC', 'DESC']) order?: 'ASC' | 'DESC';
  @IsOptional() @Type(() => Number) @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @Min(1) @Max(100) limit?: number;
}
