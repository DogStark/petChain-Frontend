import { IsArray, IsEnum, IsUUID } from 'class-validator';

export enum PetBulkAction {
  DELETE = 'DELETE',
  RESTORE = 'RESTORE',
  DEACTIVATE = 'DEACTIVATE',
  ACTIVATE = 'ACTIVATE',
}

export class BulkPetActionDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];

  @IsEnum(PetBulkAction)
  action: PetBulkAction;
}
