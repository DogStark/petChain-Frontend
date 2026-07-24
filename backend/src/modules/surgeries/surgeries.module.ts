import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SurgeriesService } from './surgeries.service';
import { SurgeriesController } from './surgeries.controller';
import { Surgery } from './entities/surgery.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([Surgery]), StorageModule],
  controllers: [SurgeriesController],
  providers: [SurgeriesService],
  exports: [SurgeriesService],
})
export class SurgeriesModule {}
