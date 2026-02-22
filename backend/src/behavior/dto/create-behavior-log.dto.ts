import { IsEnum, IsString, IsNotEmpty, IsOptional, IsDateString, IsBoolean } from 'class-validator';
import { BehaviorCategory, BehaviorSeverity } from '../entities/behavior-log.entity';

export class CreateBehaviorLogDto {
    @IsEnum(BehaviorCategory)
    @IsNotEmpty()
    category: BehaviorCategory;

    @IsEnum(BehaviorSeverity)
    @IsNotEmpty()
    severity: BehaviorSeverity;

    @IsString()
    @IsNotEmpty()
    description: string;

    @IsDateString()
    @IsNotEmpty()
    date: string;

    @IsString()
    @IsOptional()
    duration?: string;

    @IsString()
    @IsOptional()
    triggers?: string;

    @IsString()
    @IsOptional()
    location?: string;

    @IsBoolean()
    @IsOptional()
    sharedWithVet?: boolean;
}
