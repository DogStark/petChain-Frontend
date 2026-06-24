import { IsUUID, IsEnum, IsOptional, IsString } from 'class-validator';
import { ReportCategory } from '../enums/report-category.enum';

export class CreateReportDto {
  @IsUUID()
  reportedUserId: string;

  @IsEnum(ReportCategory)
  category: ReportCategory;

  @IsOptional()
  @IsString()
  description?: string;
}
