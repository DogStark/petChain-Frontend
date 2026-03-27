import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainSync } from './entities/blockchain-sync.entity';
import { MedicalRecordAnchor } from './entities/medical-record-anchor.entity';
import { BlockchainSyncService } from './blockchain-sync.service';
import { BlockchainSyncController } from './blockchain-sync.controller';
import { StellarService } from './stellar.service';
import { IPFSService } from './ipfs.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { ContractManagementService } from './contract-management.service';
import { ContractInteractionService } from './contract-interaction.service';
import { PaymentAutomationService } from './payment-automation.service';
import { ContractEventMonitorService } from './contract-event-monitor.service';
import { HashAnchoringService } from './hash-anchoring.service';
import { HashAnchoringController } from './hash-anchoring.controller';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([BlockchainSync, MedicalRecordAnchor, MedicalRecord]),
  ],
  controllers: [BlockchainSyncController, HashAnchoringController],
  providers: [
    BlockchainSyncService,
    StellarService,
    IPFSService,
    EncryptionService,
    ContractManagementService,
    ContractInteractionService,
    PaymentAutomationService,
    ContractEventMonitorService,
    HashAnchoringService,
  ],
  exports: [
    BlockchainSyncService,
    StellarService,
    EncryptionService,
    ContractManagementService,
    ContractInteractionService,
    PaymentAutomationService,
    ContractEventMonitorService,
    HashAnchoringService,
  ],
})
export class BlockchainSyncModule {}
