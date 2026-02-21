import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VetClinic } from './entities/vet-clinic.entity';
import { Appointment } from './entities/appointment.entity';
import { VetClinicsService } from './vet-clinics.service';
import { AppointmentsService } from './appointments.service';
import { VetClinicsController } from './vet-clinics.controller';
import { AppointmentsController } from './appointments.controller';
import { AppointmentWaitlistModule } from '../appointment-waitlist/appointment-waitlist.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VetClinic, Appointment]),
    forwardRef(() => AppointmentWaitlistModule),
  ],
  controllers: [VetClinicsController, AppointmentsController],
  providers: [VetClinicsService, AppointmentsService],
  exports: [VetClinicsService, AppointmentsService],
})
export class VetClinicsModule {}
