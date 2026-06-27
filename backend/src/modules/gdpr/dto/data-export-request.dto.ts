import { IsOptional, IsString } from 'class-validator';

export class DataExportRequestDto {
  @IsOptional()
  @IsString()
  format?: 'json';
}
