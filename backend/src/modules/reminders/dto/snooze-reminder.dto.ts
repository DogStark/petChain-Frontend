import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class SnoozeReminderDto {
  @IsNumber()
  @Min(1)
  @Max(30)
  @IsOptional()
  days?: number;
}
