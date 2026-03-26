import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserConsent } from './entities/user-consent.entity';
import { DataDeletionRequest } from './entities/data-deletion-request.entity';
import { GdprService } from './gdpr.service';
import { GdprController } from './gdpr.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserConsent, DataDeletionRequest])],
  controllers: [GdprController],
  providers: [GdprService],
  exports: [GdprService],
})
export class GdprModule {}
