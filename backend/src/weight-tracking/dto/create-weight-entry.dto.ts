import {
    IsNotEmpty,
    IsNumber,
    IsPositive,
    IsEnum,
    IsDateString,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WeightUnit } from '../entities/weight-entry.entity';

export class CreateWeightEntryDto {
    @ApiProperty({ example: 12.5, description: 'Weight measurement' })
    @IsNotEmpty()
    @IsNumber()
    @IsPositive()
    weight: number;

    @ApiProperty({ enum: WeightUnit, example: WeightUnit.KG, description: 'Unit of weight' })
    @IsNotEmpty()
    @IsEnum(WeightUnit)
    unit: WeightUnit;

    @ApiProperty({ example: '2025-02-21', description: 'Date of measurement (YYYY-MM-DD)' })
    @IsNotEmpty()
    @IsDateString()
    date: string;

    @ApiPropertyOptional({ example: 'After vet visit', description: 'Optional notes' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;
}