import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDate,
  IsUUID,
  IsArray,
  IsNumber,
  IsEnum,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReminderType } from '../entities/reminder.entity';

export class CreateReminderDto {
  @IsUUID()
  @IsNotEmpty()
  petId: string;

  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsEnum(ReminderType)
  @IsNotEmpty()
  type: ReminderType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  dueDate: Date;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  customIntervalDays?: number[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  notes?: string;
}
