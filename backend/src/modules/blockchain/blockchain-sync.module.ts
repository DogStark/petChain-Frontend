import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainSync } from './entities/blockchain-sync.entity';
import { BlockchainSyncService } from './blockchain-sync.service';
import { BlockchainSyncController } from './blockchain-sync.controller';
import { StellarService } from './stellar.service';
import { IPFSService } from './ipfs.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { ContractManagementService } from './contract-management.service';
import { ContractInteractionService } from './contract-interaction.service';
import { PaymentAutomationService } from './payment-automation.service';
import { ContractEventMonitorService } from './contract-event-monitor.service';

@Module({
  imports: [TypeOrmModule.forFeature([BlockchainSync])],
  controllers: [BlockchainSyncController],
  providers: [
    BlockchainSyncService,
    StellarService,
    IPFSService,
    EncryptionService,
    ContractManagementService,
    ContractInteractionService,
    PaymentAutomationService,
    ContractEventMonitorService,
  ],
  exports: [
    BlockchainSyncService,
    StellarService,
    EncryptionService,
    ContractManagementService,
    ContractInteractionService,
    PaymentAutomationService,
    ContractEventMonitorService,
  ],
})
export class BlockchainSyncModule {}
