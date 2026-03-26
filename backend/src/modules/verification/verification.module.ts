import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationResult } from './entities/verification-result.entity';
import { VerificationAudit } from './entities/verification-audit.entity';
import { VerificationService } from './verification.service';
import { VerificationController } from './controllers/verification.controller';
import { BlockchainSyncModule } from '../blockchain/blockchain-sync.module';
import { MedicalRecordsModule } from '../medical-records/medical-records.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VerificationResult, VerificationAudit]),
    BlockchainSyncModule,
    MedicalRecordsModule,
  ],
  controllers: [VerificationController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
