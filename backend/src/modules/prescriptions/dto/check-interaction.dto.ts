import { IsString, IsUUID } from 'class-validator';

export class CheckInteractionDto {
  @IsUUID()
  petId: string;

  @IsString()
  medication: string;
}
