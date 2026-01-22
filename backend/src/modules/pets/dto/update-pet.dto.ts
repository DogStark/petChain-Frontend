import { PartialType } from '@nestjs/mapped-types';
import { CreatePetDto } from './create-pet.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePetDto extends PartialType(CreatePetDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
