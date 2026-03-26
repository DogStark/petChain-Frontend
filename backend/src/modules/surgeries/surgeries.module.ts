import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SurgeriesService } from './surgeries.service';
import { SurgeriesController } from './surgeries.controller';
import { Surgery } from './entities/surgery.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Surgery])],
  controllers: [SurgeriesController],
  providers: [SurgeriesService],
  exports: [SurgeriesService],
})
export class SurgeriesModule {}
