import { IsArray, IsUUID } from 'class-validator';

export class ReorderPhotosDto {
  @IsArray()
  @IsUUID('4', { each: true })
  photoIds: string[];
}
