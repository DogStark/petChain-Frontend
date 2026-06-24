import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block } from './entities/block.entity';
import { Report } from './entities/report.entity';
import { BlockingReportingService } from './blocking-reporting.service';
import { BlockingReportingController } from './blocking-reporting.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Block, Report])],
  providers: [BlockingReportingService],
  controllers: [BlockingReportingController],
  exports: [BlockingReportingService],
})
export class BlockingReportingModule {}
