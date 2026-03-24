import { IsUUID, IsString, IsOptional } from 'class-validator';

export class VerifyRecordDto {
    @IsUUID()
    vetId: string;

    @IsString()
    digitalSignature: string;

    @IsOptional()
    @IsString()
    notes?: string;
}

export class RevokeVerificationDto {
    @IsUUID()
    vetId: string;

    @IsString()
    reason: string;
}
