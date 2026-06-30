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
import { MfaConfig } from './entities/mfa-config.entity';
import { MfaService } from './mfa.service';
import { MfaController } from './mfa.controller';
import { MfaGuard } from './guards/mfa.guard';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([MfaConfig]), AuthModule],
  controllers: [MfaController],
  providers: [MfaService, MfaGuard],
  exports: [MfaService, MfaGuard],
})
export class MfaModule {}
