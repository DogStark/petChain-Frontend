import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { appConfig } from './config/app.config';
import { authConfig } from './config/auth.config';
import { databaseConfig } from './config/database.config';
import { storageConfig } from './config/storage.config';
import { processingConfig } from './config/processing.config';
import { cdnConfig } from './config/cdn.config';
import { stellarConfig } from './config/stellar.config';
import { AuthModule } from './auth/auth.module';

// Feature Modules
import { UsersModule } from './modules/users/users.module';
import { QRCodesModule } from './modules/qrcodes/qrcodes.module';
import { PetsModule } from './modules/pets/pets.module';
import { VaccinationsModule } from './modules/vaccinations/vaccinations.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { VetClinicsModule } from './modules/vet-clinics/vet-clinics.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { MedicalRecordsModule } from './modules/medical-records/medical-records.module';
import { VetsModule } from './modules/vets/vets.module';
import { EmergencyServicesModule } from './modules/emergency-services/emergency-services.module';
import { SearchModule } from './modules/search/search.module';
import { LostPetsModule } from './modules/lost-pets/lost-pets.module';
import { AllergiesModule } from './modules/allergies/allergies.module';
import { ConditionsModule } from './modules/conditions/conditions.module';

// File Upload & Storage Modules
import { StorageModule } from './modules/storage/storage.module';
import { UploadModule } from './modules/upload/upload.module';
import { ValidationModule } from './modules/validation/validation.module';
import { SecurityModule } from './modules/security/security.module';
import { ProcessingModule } from './modules/processing/processing.module';
import { CdnModule } from './modules/cdn/cdn.module';
import { FilesModule } from './modules/files/files.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { EmailModule } from './modules/email/email.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    // Configuration Module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        storageConfig,
        processingConfig,
        cdnConfig,
        stellarConfig,
      ],
      envFilePath: '.env',
    }),

    // Scheduler Module
    ScheduleModule.forRoot(),

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
    AuthModule,
    UsersModule,
    QRCodesModule,
    PetsModule,
    VaccinationsModule,
    PrescriptionsModule,
    RemindersModule,
    VetClinicsModule,
    CertificatesModule,
    MedicalRecordsModule,
    VetsModule,
    EmergencyServicesModule,
    SearchModule,
    LostPetsModule,
    AllergiesModule,
    ConditionsModule,

    // File Upload, Storage, Security & Processing
    StorageModule,
    UploadModule,
    ValidationModule,
    SecurityModule,
    ProcessingModule,
    CdnModule,
    FilesModule,
    RealtimeModule,
    WalletsModule,
    // Email
    EmailModule,
    // Notifications
    NotificationsModule,
    // Analytics
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
