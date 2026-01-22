import { PartialType } from '@nestjs/mapped-types';
import { CreateAllergyDto } from './create-allergy.dto';

export class UpdateAllergyDto extends PartialType(CreateAllergyDto) {}
