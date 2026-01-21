import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDate,
  IsUUID,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentType } from '../entities/appointment.entity';

export class CreateAppointmentDto {
  @IsUUID()
  @IsNotEmpty()
  petId: string;

  @IsUUID()
  @IsNotEmpty()
  vetClinicId: string;

  @IsUUID()
  @IsOptional()
  reminderId?: string;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  scheduledDate: Date;

  @IsNumber()
  @Min(15)
  @IsOptional()
  duration?: number;

  @IsEnum(AppointmentType)
  @IsOptional()
  type?: AppointmentType;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  veterinarianName?: string;
}
