import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { UserConsent } from './entities/user-consent.entity';
import { DataDeletionRequest } from './entities/data-deletion-request.entity';
import { GdprRequest } from './entities/gdpr-request.entity';
import { GdprService } from './gdpr.service';
import { GdprController } from './gdpr.controller';
import { GdprProcessor } from './gdpr.processor';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserConsent, DataDeletionRequest, GdprRequest]),
    BullModule.registerQueue({ name: 'gdpr' }),
    StorageModule,
  ],
  controllers: [GdprController],
  providers: [GdprService, GdprProcessor],
  exports: [GdprService],
})
export class GdprModule {}
