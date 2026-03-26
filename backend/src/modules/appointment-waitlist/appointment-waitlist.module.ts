import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentWaitlistEntry } from './entities/appointment-waitlist-entry.entity';
import { AppointmentWaitlistService } from './appointment-waitlist.service';
import { AppointmentWaitlistController } from './appointment-waitlist.controller';
import { PetsModule } from '../pets/pets.module';
import { VetClinicsModule } from '../vet-clinics/vet-clinics.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppointmentWaitlistEntry]),
    PetsModule,
    forwardRef(() => VetClinicsModule),
    NotificationsModule,
  ],
  controllers: [AppointmentWaitlistController],
  providers: [AppointmentWaitlistService],
  exports: [AppointmentWaitlistService],
})
export class AppointmentWaitlistModule {}
