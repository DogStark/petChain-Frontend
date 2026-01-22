import { PartialType } from '@nestjs/mapped-types';
import { CreateVaccinationScheduleDto } from './create-vaccination-schedule.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateVaccinationScheduleDto extends PartialType(
  CreateVaccinationScheduleDto,
) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
