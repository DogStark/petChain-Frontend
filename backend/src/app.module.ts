import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { UsersModule } from './modules/users/users.module';
import { PetsModule } from './modules/pets/pets.module';
import { VetsModule } from './modules/vets/vets.module';
import { MedicalRecordsModule } from './modules/medical-records/medical-records.module';
import { VaccinationsModule } from './modules/vaccinations/vaccinations.module';
import { AllergiesModule } from './modules/allergies/allergies.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    // Configuration Module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
      envFilePath: '.env',
    }),

    // TypeORM Module
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get('database');
        if (!dbConfig) {
          throw new Error('Database configuration not found');
        }
        return dbConfig;
      },
    }),

    // Feature Modules
    UsersModule,
    PetsModule,
    VetsModule,
    MedicalRecordsModule,
    VaccinationsModule,
    AllergiesModule,
    PrescriptionsModule,
    AppointmentsModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
