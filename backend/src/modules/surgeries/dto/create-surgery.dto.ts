import { IsString, IsEnum, IsDateString, IsOptional, IsUUID, IsArray, IsObject, IsNumber } from 'class-validator';
import { SurgeryStatus } from '../entities/surgery.entity';

export class CreateSurgeryDto {
  @IsUUID()
  petId: string;

  @IsOptional()
  @IsUUID()
  vetId?: string;

  @IsString()
  surgeryType: string;

  @IsDateString()
  surgeryDate: string;

  @IsOptional()
  @IsEnum(SurgeryStatus)
  status?: SurgeryStatus;

  @IsOptional()
  @IsString()
  preOpNotes?: string;

  @IsOptional()
  @IsString()
  postOpNotes?: string;

  @IsOptional()
  @IsObject()
  anesthesiaDetails?: {
    type?: string;
    dosage?: string;
    duration?: number;
    complications?: string;
  };

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  complications?: string[];

  @IsOptional()
  @IsObject()
  recoveryTimeline?: {
    expectedDays?: number;
    milestones?: Array<{ date: string; description: string; completed: boolean }>;
  };

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}
