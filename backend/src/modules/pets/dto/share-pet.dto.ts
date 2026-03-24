import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class SharePetDto {
  @IsUUID()
  sharedWithUserId: string;

  @IsBoolean()
  @IsOptional()
  canEdit?: boolean = false;
}
