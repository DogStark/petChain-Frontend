import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDate,
  IsUUID,
  IsArray,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReminderDto {
  @IsUUID()
  @IsNotEmpty()
  petId: string;

  @IsUUID()
  @IsOptional()
  vaccinationScheduleId?: string;

  @IsString()
  @IsNotEmpty()
  vaccineName: string;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  dueDate: Date;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  customIntervalDays?: number[];

  @IsString()
  @IsOptional()
  notes?: string;
}
