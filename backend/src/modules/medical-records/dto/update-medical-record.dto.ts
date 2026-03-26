import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateMedicalRecordDto } from './create-medical-record.dto';

export class UpdateMedicalRecordDto extends PartialType(
  CreateMedicalRecordDto,
) {
  @IsOptional()
  @IsString()
  changeReason?: string;
}
