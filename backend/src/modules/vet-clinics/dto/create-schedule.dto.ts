import { IsEnum, IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { DayOfWeek } from '../entities/clinic-schedule.entity';

export class CreateScheduleDto {
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'openTime must be HH:MM' })
  openTime: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'closeTime must be HH:MM' })
  closeTime: string;

  @IsInt()
  @Min(15)
  @Max(240)
  slotDurationMinutes: number = 30;
}
