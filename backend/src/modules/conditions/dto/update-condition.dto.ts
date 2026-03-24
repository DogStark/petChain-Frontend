import { PartialType } from '@nestjs/mapped-types';
import { CreateConditionDto } from './create-condition.dto';

export class UpdateConditionDto extends PartialType(CreateConditionDto) {}
