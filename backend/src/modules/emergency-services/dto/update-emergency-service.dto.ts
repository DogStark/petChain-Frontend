import { PartialType } from '@nestjs/mapped-types';
import { CreateEmergencyServiceDto } from './create-emergency-service.dto';

export class UpdateEmergencyServiceDto extends PartialType(
  CreateEmergencyServiceDto,
) {}
