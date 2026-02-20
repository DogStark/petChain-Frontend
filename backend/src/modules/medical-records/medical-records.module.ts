import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MedicalRecordsService } from './medical-records.service';
import { MedicalRecordsController } from './medical-records.controller';
import { MedicalRecordsExportService } from './medical-records-export.service';
import { MedicalRecord } from './entities/medical-record.entity';
import { RecordTemplate } from './entities/record-template.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MedicalRecord, RecordTemplate]),
    ConfigModule,
  ],
  controllers: [MedicalRecordsController],
  providers: [MedicalRecordsService, MedicalRecordsExportService],
  exports: [MedicalRecordsService],
})
export class MedicalRecordsModule {}
