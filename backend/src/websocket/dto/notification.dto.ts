import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum NotificationType {
  APPOINTMENT = 'APPOINTMENT',
  MEDICATION = 'MEDICATION',
  CONSULTATION = 'CONSULTATION',
  ALERT = 'ALERT',
  MESSAGE = 'MESSAGE',
}

export class NotificationDto {
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  targetUserId?: string;

  @IsString()
  @IsOptional()
  metadata?: any;
}
