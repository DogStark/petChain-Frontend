import { PartialType } from '@nestjs/mapped-types';
import { CreateSurgeryDto } from './create-surgery.dto';

export class UpdateSurgeryDto extends PartialType(CreateSurgeryDto) {}
