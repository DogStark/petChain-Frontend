import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MfaService } from './mfa.service';
import { MfaController } from './mfa.controller';
import { MfaRecord } from './entities/mfa-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MfaRecord])],
  controllers: [MfaController],
  providers: [MfaService],
  exports: [MfaService],
})
export class MfaModule {}
