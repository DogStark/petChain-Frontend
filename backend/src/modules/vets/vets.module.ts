import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VetsService } from './vets.service';
import { VetsController } from './vets.controller';
import { Vet } from './entities/vet.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vet])],
  controllers: [VetsController],
  providers: [VetsService],
  exports: [VetsService],
})
export class VetsModule {}
