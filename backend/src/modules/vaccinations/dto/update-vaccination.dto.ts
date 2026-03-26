import { PartialType } from '@nestjs/mapped-types';
import { CreateVaccinationDto } from './create-vaccination.dto';

export class UpdateVaccinationDto extends PartialType(CreateVaccinationDto) {}
