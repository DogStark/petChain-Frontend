import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MedicalRecordsService } from './medical-records.service';
import { MedicalRecordsController } from './medical-records.controller';
import { MedicalRecordsExportService } from './medical-records-export.service';
import { RecordShareService } from './services/record-share.service';
import { RecordShareController } from './controllers/record-share.controller';
import { MedicalRecord } from './entities/medical-record.entity';
import { RecordTemplate } from './entities/record-template.entity';
import { RecordVersion } from './entities/record-version.entity';
import { AuditModule } from '../audit/audit.module';
import { SecurityModule } from '../security/security.module';
import { AuthModule } from '../../auth/auth.module';
import { EncryptionService } from '../../security/services/encryption.service';
import { KeyRotationService } from '../../security/services/key-rotation.service';
import { setEncryptionService } from '../../common/transformers/encrypted.transformer';
import { BlockchainSyncModule } from '../blockchain/blockchain-sync.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MedicalRecord, RecordTemplate, RecordVersion]),
    ConfigModule,
    AuditModule,
    SecurityModule,
    AuthModule,
    BlockchainSyncModule,
  ],
  controllers: [MedicalRecordsController, RecordShareController],
  providers: [
    MedicalRecordsService,
    MedicalRecordsExportService,
    RecordShareService,
    KeyRotationService,
  ],
  exports: [MedicalRecordsService, RecordShareService],
})
export class MedicalRecordsModule implements OnModuleInit {
  constructor(private readonly encryptionService: EncryptionService) {}

  onModuleInit() {
    setEncryptionService(this.encryptionService);
  }
}
