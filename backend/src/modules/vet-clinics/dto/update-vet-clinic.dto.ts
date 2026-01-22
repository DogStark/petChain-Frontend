import { PartialType } from '@nestjs/mapped-types';
import { CreateVetClinicDto } from './create-vet-clinic.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateVetClinicDto extends PartialType(CreateVetClinicDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
