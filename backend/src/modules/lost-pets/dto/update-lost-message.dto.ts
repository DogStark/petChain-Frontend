import { IsString, IsOptional } from 'class-validator';

export class UpdateLostMessageDto {
  @IsString()
  @IsOptional()
  customMessage?: string;

  @IsOptional()
  @IsString()
  contactInfo?: string;
}
