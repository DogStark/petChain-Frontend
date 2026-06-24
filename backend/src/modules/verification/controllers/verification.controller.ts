import { Controller, Post, Get, Body, Param, Req } from '@nestjs/common';
import { VerificationService } from '../verification.service';
import { Request } from 'express';
import { VerifyRecordDto, VerifyBatchDto } from '../dto/verification.dto';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('verify')
  async verify(@Body() body: VerifyRecordDto, @Req() req: Request) {
    const userId = (req as any).user?.id || body.userId; // Fallback to body if req.user not available
    const ipAddress = req.ip;
    return await this.verificationService.verifyRecord(
      body.recordId,
      body.recordType,
      userId,
      ipAddress,
    );
  }

  @Post('verify-batch')
  async verifyBatch(@Body() body: VerifyBatchDto, @Req() req: Request) {
    const userId = (req as any).user?.id;
    return await this.verificationService.verifyBatch(
      body.recordIds,
      body.recordType,
      userId,
    );
  }

  @Get('history/:recordId')
  async getHistory(@Param('recordId') recordId: string) {
    return await this.verificationService.getAuditTrail(recordId);
  }

  @Get('transaction-history/:recordId')
  async getTransactionHistory(@Param('recordId') recordId: string) {
    return await this.verificationService.getTransactionHistory(recordId);
  }

  @Get('status/:recordId')
  async getStatus(@Param('recordId') recordId: string) {
    // This could just return the latest VerificationResult from cache
    return await this.verificationService.verifyRecord(recordId, 'UNKNOWN'); // Type will be retrieved from record anyway
  }
}
