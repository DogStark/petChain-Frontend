import { PartialType } from '@nestjs/mapped-types';
import { CreateDrugInteractionDto } from './create-drug-interaction.dto';

export class UpdateDrugInteractionDto extends PartialType(
  CreateDrugInteractionDto,
) {}
