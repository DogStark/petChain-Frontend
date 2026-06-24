import { Module } from '@nestjs/common';
import { VetVerificationService } from './vet-verification.service';
import { VetVerificationController } from './vet-verification.controller';
import { RedisCacheModule } from '../modules/cache/cache.module';

@Module({
  imports: [RedisCacheModule],
  providers: [VetVerificationService],
  controllers: [VetVerificationController],
})
export class VetVerificationModule {}
