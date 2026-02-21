import { IsEnum, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportStatus } from '../enums/report-status.enum';
import { ReportCategory } from '../enums/report-category.enum';

export class ReportFilterDto {
  @IsEnum(ReportStatus)
  @IsOptional()
  status?: ReportStatus;

  @IsEnum(ReportCategory)
  @IsOptional()
  category?: ReportCategory;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startDate?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  endDate?: Date;
}
