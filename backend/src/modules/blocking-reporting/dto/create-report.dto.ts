import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ReportCategory } from '../enums/report-category.enum';

export class CreateReportDto {
  @IsUUID()
  @IsNotEmpty()
  reportedUserId: string;

  @IsEnum(ReportCategory)
  @IsNotEmpty()
  category: ReportCategory;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}
