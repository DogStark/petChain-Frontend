import { PartialType } from '@nestjs/mapped-types';
import { CreateVaccinationReactionDto } from './create-vaccination-reaction.dto';

export class UpdateVaccinationReactionDto extends PartialType(
  CreateVaccinationReactionDto,
) {}
