import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsEnum,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { AppointmentType } from '../entities/appointment-waitlist-entry.entity';

export class CreateAppointmentWaitlistEntryDto {
  @IsUUID('4')
  @IsNotEmpty()
  petId: string;

  @IsUUID('4')
  @IsNotEmpty()
  vetClinicId: string;

  /** Lower number = higher priority. Default 0. */
  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  /** Preferred appointment type. Omit for any type. */
  @IsEnum(AppointmentType)
  @IsOptional()
  preferredType?: AppointmentType;

  /** ISO date string. Entry expires at this time. Default: 30 days from now. */
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
