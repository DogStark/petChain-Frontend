import { IsNumber, Min } from 'class-validator';

export class SetSpendingLimitDto {
  @IsNumber()
  @Min(0)
  limitCents: number;
}
