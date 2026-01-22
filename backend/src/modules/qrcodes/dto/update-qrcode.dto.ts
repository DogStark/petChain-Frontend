import { PartialType } from '@nestjs/mapped-types';
import { CreateQRCodeDto } from './create-qrcode.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateQRCodeDto extends PartialType(CreateQRCodeDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
