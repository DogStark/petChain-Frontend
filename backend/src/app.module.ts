import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { appConfig } from './config/app.config';
import { authConfig } from './config/auth.config';
import { databaseConfig } from './config/database.config';
import { AuthModule } from './auth/auth.module';

// Feature Modules
import { UsersModule } from './modules/users/users.module';
import { QRCodesModule } from './modules/qrcodes/qrcodes.module';
import { PetsModule } from './modules/pets/pets.module';
import { VaccinationsModule } from './modules/vaccinations/vaccinations.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { VetClinicsModule } from './modules/vet-clinics/vet-clinics.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { blockchainConfig } from './config/blockchain.config';
import { BlockchainSyncModule } from './modules/blockchain/blockchain-sync.module';

@Module({
  imports: [
    // Configuration Module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, databaseConfig, blockchainConfig],
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
    AuthModule,
    UsersModule,
    QRCodesModule,
    PetsModule,
    VaccinationsModule,
    RemindersModule,
    VetClinicsModule,
    CertificatesModule,
    BlockchainSyncModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
