import { Controller, Get, Post, Param, Query, Body, NotFoundException } from '@nestjs/common';
import { BlockchainSyncService } from './blockchain-sync.service';
import { RecordType } from './entities/blockchain-sync.entity';

@Controller('blockchain-sync')
export class BlockchainSyncController {
  constructor(private readonly syncService: BlockchainSyncService) {}

  @Get('status/:recordId')
  async getStatus(@Param('recordId') recordId: string) {
    return this.syncService.getSyncStatus(recordId);
  }

  @Post('verify/:recordId')
  async verify(
    @Param('recordId') recordId: string,
    @Body('recordType') recordType: RecordType,
    @Body('data') data: any,
  ) {
    return this.syncService.verifyRecord(recordId, recordType, data);
  }

  // Note: Usually sync is triggered by internal events or hooks in other modules,
  // but we expose an endpoint for manual sync as per requirements.
  @Post('trigger/:recordId')
  async triggerSync(
    @Param('recordId') recordId: string,
    @Body('recordType') recordType: RecordType,
    @Body('data') data: any,
  ) {
    return this.syncService.syncRecord(recordId, recordType, data);
  }
}
