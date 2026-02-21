import { IsEnum, IsOptional, IsDateString, IsString } from 'class-validator';
import { BehaviorCategory, BehaviorSeverity } from '../entities/behavior-log.entity';

export class BehaviorFilterDto {
    @IsEnum(BehaviorCategory)
    @IsOptional()
    category?: BehaviorCategory;

    @IsEnum(BehaviorSeverity)
    @IsOptional()
    severity?: BehaviorSeverity;

    @IsDateString()
    @IsOptional()
    startDate?: string;

    @IsDateString()
    @IsOptional()
    endDate?: string;

    @IsString()
    @IsOptional()
    search?: string;
}
