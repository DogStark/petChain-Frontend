import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmergencyServicesController } from './emergency-services.controller';
import { EmergencyServicesService } from './emergency-services.service';
import { EmergencyService } from './entities/emergency-service.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EmergencyService])],
  controllers: [EmergencyServicesController],
  providers: [EmergencyServicesService],
  exports: [EmergencyServicesService],
})
export class EmergencyServicesModule {}
