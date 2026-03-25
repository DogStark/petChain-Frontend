import { IsString, IsArray, IsUUID, IsOptional, IsEnum } from 'class-validator';

export class VerifyRecordDto {
  @IsUUID()
  recordId: string;

  @IsString()
  recordType: string;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class VerifyBatchDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  recordIds: string[];

  @IsString()
  recordType: string;
}
