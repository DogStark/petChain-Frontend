import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block } from './entities/block.entity';
import { Report } from './entities/report.entity';
import { ReportNote } from './entities/report-note.entity';
import { BlockService } from './services/block.service';
import { ReportService } from './services/report.service';
import { BlockController } from './controllers/block.controller';
import { ReportController } from './controllers/report.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Block, Report, ReportNote]), AuditModule],
  providers: [BlockService, ReportService],
  controllers: [BlockController, ReportController],
  exports: [BlockService, ReportService],
})
export class BlockingReportingModule { }
