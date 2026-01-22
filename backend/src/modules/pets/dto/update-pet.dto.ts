import { PartialType } from '@nestjs/mapped-types';
import { CreatePetDto } from './create-pet.dto';
<<<<<<< HEAD

export class UpdatePetDto extends PartialType(CreatePetDto) {}
=======
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePetDto extends PartialType(CreatePetDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
>>>>>>> 2740dfc9f1ae7475a6ba260b78e15df3336d9c8b
