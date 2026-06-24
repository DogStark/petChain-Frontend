import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZkpProof } from './entities/zkp-proof.entity';
import { ZkpService } from './zkp.service';
import { ZkpController } from './zkp.controller';
import { VaccinationsModule } from '../vaccinations/vaccinations.module';

@Module({
  imports: [TypeOrmModule.forFeature([ZkpProof]), VaccinationsModule],
  controllers: [ZkpController],
  providers: [ZkpService],
  exports: [ZkpService],
})
export class ZkpModule {}
