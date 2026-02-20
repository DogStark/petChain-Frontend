import { PartialType } from '@nestjs/mapped-types';
import { CreateReminderDto } from './create-reminder.dto';
import { IsEnum, IsOptional, IsDate } from 'class-validator';
import { ReminderStatus } from '../entities/reminder.entity';
import { Type } from 'class-transformer';

export class UpdateReminderDto extends PartialType(CreateReminderDto) {
  @IsEnum(ReminderStatus)
  @IsOptional()
  status?: ReminderStatus;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  snoozedUntil?: Date;
}
