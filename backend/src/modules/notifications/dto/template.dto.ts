import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';
import { TemplateChannel } from '../entities/notification-template.entity';

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(TemplateChannel)
  channel: TemplateChannel;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  body: string;
}

export class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class RenderTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(TemplateChannel)
  channel: TemplateChannel;

  @IsOptional()
  variables?: Record<string, string>;
}
