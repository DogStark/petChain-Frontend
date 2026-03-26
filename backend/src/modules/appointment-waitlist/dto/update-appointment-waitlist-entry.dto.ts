import { IsOptional, IsInt, Min, IsDateString } from 'class-validator';

/** Only priority and expiresAt can be updated. */
export class UpdateAppointmentWaitlistEntryDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
