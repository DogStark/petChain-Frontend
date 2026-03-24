import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString } from 'class-validator';

export class CreateAdverseReactionDto {
  @IsString()
  reaction: string;

  @IsString()
  @IsOptional()
  severity?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  onsetAt?: Date;

  @IsString()
  @IsOptional()
  notes?: string;
}
