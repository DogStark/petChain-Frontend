import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainSync } from './entities/blockchain-sync.entity';
import { BlockchainSyncService } from './blockchain-sync.service';
import { BlockchainSyncController } from './blockchain-sync.controller';
import { StellarService } from './stellar.service';
import { IPFSService } from './ipfs.service';
import { EncryptionService } from '../../common/services/encryption.service';

@Module({
  imports: [TypeOrmModule.forFeature([BlockchainSync])],
  controllers: [BlockchainSyncController],
  providers: [
    BlockchainSyncService,
    StellarService,
    IPFSService,
    EncryptionService,
  ],
  exports: [BlockchainSyncService],
})
export class BlockchainSyncModule {}
