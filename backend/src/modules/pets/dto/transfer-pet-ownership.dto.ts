import { IsNotEmpty, IsUUID } from 'class-validator';

export class TransferPetOwnershipDto {
  @IsUUID()
  @IsNotEmpty()
  newOwnerId: string;
}
