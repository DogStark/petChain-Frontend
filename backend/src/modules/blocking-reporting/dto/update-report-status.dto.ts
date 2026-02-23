import { IsEnum, IsNotEmpty } from 'class-validator';
import { ReportStatus } from '../enums/report-status.enum';

export class UpdateReportStatusDto {
  @IsEnum(ReportStatus)
  @IsNotEmpty()
  status: ReportStatus;
}
