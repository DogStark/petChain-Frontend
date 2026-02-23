import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MedicalRecordsService } from './medical-records.service';
import { MedicalRecordsController } from './medical-records.controller';
import { MedicalRecordsExportService } from './medical-records-export.service';
import { RecordShareService } from './services/record-share.service';
import { RecordShareController } from './controllers/record-share.controller';
import { MedicalRecord } from './entities/medical-record.entity';
import { RecordTemplate } from './entities/record-template.entity';
import { RecordShare } from './entities/record-share.entity';
import { RecordShareAccess } from './entities/record-share-access.entity';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MedicalRecord,
      RecordTemplate,
      RecordShare,
      RecordShareAccess,
    ]),
    ConfigModule,
    JwtModule.register({}),
    EmailModule,
  ],
  controllers: [MedicalRecordsController, RecordShareController],
  providers: [
    MedicalRecordsService,
    MedicalRecordsExportService,
    RecordShareService,
  ],
  exports: [MedicalRecordsService, RecordShareService],
})
export class MedicalRecordsModule {}
