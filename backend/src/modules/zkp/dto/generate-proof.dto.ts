import { IsUUID, IsOptional, IsDateString } from 'class-validator';

export class GenerateProofDto {
  @IsUUID()
  vaccinationId: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
