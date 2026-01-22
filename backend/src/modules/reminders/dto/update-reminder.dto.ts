import { PartialType } from '@nestjs/mapped-types';
import { CreateReminderDto } from './create-reminder.dto';
import { IsEnum, IsOptional, IsDate, IsUUID } from 'class-validator';
import { ReminderStatus } from '../entities/vaccination-reminder.entity';
import { Type } from 'class-transformer';

export class UpdateReminderDto extends PartialType(CreateReminderDto) {
  @IsEnum(ReminderStatus)
  @IsOptional()
  status?: ReminderStatus;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  snoozedUntil?: Date;

  @IsUUID()
  @IsOptional()
  vaccinationId?: string;
}
