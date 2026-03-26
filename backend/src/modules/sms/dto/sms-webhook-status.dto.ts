import { IsOptional, IsString } from 'class-validator';

export class SmsWebhookStatusDto {
  @IsString()
  MessageSid: string;

  @IsString()
  MessageStatus: string;

  @IsOptional()
  @IsString()
  ErrorCode?: string;

  @IsOptional()
  @IsString()
  ErrorMessage?: string;

  @IsOptional()
  @IsString()
  MessagePrice?: string;
}
