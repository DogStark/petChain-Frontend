import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsBoolean,
    IsArray,
    IsUUID,
    IsUrl,
    IsInt,
    Min,
    Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationCategory } from '../entities/notification.entity';

// ── Create ────────────────────────────────────────────────────────────────────

export class CreateNotificationDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    message: string;

    @IsEnum(NotificationCategory)
    category: NotificationCategory;

    @IsUrl()
    @IsOptional()
    actionUrl?: string;

    @IsOptional()
    metadata?: Record<string, unknown>;
}

// ── Query / Filtering ─────────────────────────────────────────────────────────

export class NotificationQueryDto {
    @IsEnum(NotificationCategory)
    @IsOptional()
    category?: NotificationCategory;

    @IsBoolean()
    @IsOptional()
    @Type(() => Boolean)
    isRead?: boolean;

    @IsInt()
    @Min(1)
    @IsOptional()
    @Type(() => Number)
    page?: number = 1;

    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    @Type(() => Number)
    limit?: number = 20;
}

// ── Bulk Actions ──────────────────────────────────────────────────────────────

export enum BulkAction {
    MARK_READ = 'MARK_READ',
    MARK_UNREAD = 'MARK_UNREAD',
    DELETE = 'DELETE',
}

export class BulkActionDto {
    @IsArray()
    @IsUUID('4', { each: true })
    ids: string[];

    @IsEnum(BulkAction)
    action: BulkAction;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export class UpdateNotificationSettingDto {
    @IsBoolean()
    @IsOptional()
    globalEnabled?: boolean;

    @IsBoolean()
    @IsOptional()
    appointment?: boolean;

    @IsBoolean()
    @IsOptional()
    medication?: boolean;

    @IsBoolean()
    @IsOptional()
    consultation?: boolean;

    @IsBoolean()
    @IsOptional()
    alert?: boolean;

    @IsBoolean()
    @IsOptional()
    message?: boolean;

    @IsBoolean()
    @IsOptional()
    vaccination?: boolean;

    @IsBoolean()
    @IsOptional()
    lostPet?: boolean;

    @IsBoolean()
    @IsOptional()
    medicalRecord?: boolean;

    @IsBoolean()
    @IsOptional()
    system?: boolean;
}
