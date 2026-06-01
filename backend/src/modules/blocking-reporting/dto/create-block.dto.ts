import { IsUUID, IsNotEmpty } from 'class-validator';

export class CreateBlockDto {
  @IsUUID()
  @IsNotEmpty()
  blockedId: string;
}