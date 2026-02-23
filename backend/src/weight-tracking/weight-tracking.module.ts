import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeightEntry } from './entities/weight-entry.entity';
import { WeightTrackingController } from './weight-tracking.controller';
import { WeightTrackingService } from './weight-tracking.service';

@Module({
    imports: [TypeOrmModule.forFeature([WeightEntry])],
    controllers: [WeightTrackingController],
    providers: [WeightTrackingService],
    exports: [WeightTrackingService],
})
export class WeightTrackingModule {}