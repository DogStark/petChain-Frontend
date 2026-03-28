import { Module } from '@nestjs/common';
import { VetVerificationService } from './vet-verification.service';
import { VetVerificationController } from './vet-verification.controller';

@Module({
  providers: [VetVerificationService],
  controllers: [VetVerificationController],
})
export class VetVerificationModule {}
