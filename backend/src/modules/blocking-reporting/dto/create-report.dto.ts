import { IsUUID, IsEnum, IsOptional, IsString } from 'class-validator';
import { ReportTargetType, ReportReason } from '../entities/report.entity';

export class CreateReportDto {
  @IsUUID()
  targetId: string;

  @IsEnum(ReportTargetType)
  targetType: ReportTargetType;

  @IsEnum(ReportReason)
  reason: ReportReason;

  @IsOptional()
  @IsString()
  description?: string;
}