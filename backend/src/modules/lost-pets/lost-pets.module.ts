import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LostPetReport } from './entities/lost-pet-report.entity';
import { LostPetsService } from './lost-pets.service';
import { LostPetsController } from './lost-pets.controller';
import { PetsModule } from '../pets/pets.module';
import { QRCodesModule } from '../qrcodes/qrcodes.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UserLocation } from '../users/entities/user-location.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LostPetReport, UserLocation]),
    forwardRef(() => PetsModule),
    AuthModule,
    QRCodesModule,
    NotificationsModule,
  ],
  controllers: [LostPetsController],
  providers: [LostPetsService],
  exports: [LostPetsService],
})
export class LostPetsModule {}
