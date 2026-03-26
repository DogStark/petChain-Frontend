import {
  IsString,
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { AppointmentStatus } from '../entities/appointment.entity';

export class CreateAppointmentDto {
  @IsUUID()
  petId: string;

  @IsUUID()
  vetId: string;

  @IsDateString()
  appointmentDate: string;

  @IsString()
  appointmentTime: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
