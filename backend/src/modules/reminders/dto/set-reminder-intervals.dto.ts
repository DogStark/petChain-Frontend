import { IsArray, IsNumber, Min } from 'class-validator';

export class SetReminderIntervalsDto {
  @IsArray()
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  intervals: number[];
}
