import { IsUUID } from 'class-validator';

export class VerifyProofDto {
  @IsUUID()
  proofId: string;
}
