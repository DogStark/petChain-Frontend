import { Controller, Get, Post, Param, Query, Body, NotFoundException } from '@nestjs/common';
import { BlockchainSyncService } from './blockchain-sync.service';
import { StellarService } from './stellar.service';
import { RecordType } from './entities/blockchain-sync.entity';
import { xdr } from '@stellar/stellar-sdk';

@Controller('blockchain-sync')
export class BlockchainSyncController {
  constructor(
    private readonly syncService: BlockchainSyncService,
    private readonly stellarService: StellarService,
  ) {}

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

  @Post('trigger/:recordId')
  async triggerSync(
    @Param('recordId') recordId: string,
    @Body('recordType') recordType: RecordType,
    @Body('data') data: any,
  ) {
    return this.syncService.syncRecord(recordId, recordType, data);
  }

  @Post('contract/deploy')
  async deployContract(@Body('wasmHash') wasmHash: string) {
    return this.stellarService.deployContract(wasmHash);
  }

  @Post('contract/invoke')
  async invokeContract(
    @Body('contractId') contractId: string,
    @Body('method') method: string,
    @Body('params') params?: any[],
  ) {
    return this.stellarService.invokeContract(contractId, method, params);
  }

  @Post('contract/upgrade')
  async upgradeContract(
    @Body('contractId') contractId: string,
    @Body('newWasmHash') newWasmHash: string,
  ) {
    return this.stellarService.upgradeContract(contractId, newWasmHash);
  }

  @Post('contract/estimate-gas')
  async estimateGas(
    @Body('contractId') contractId: string,
    @Body('method') method: string,
    @Body('params') params?: any[],
  ) {
    return this.stellarService.estimateGas(contractId, method, params);
  }
}
