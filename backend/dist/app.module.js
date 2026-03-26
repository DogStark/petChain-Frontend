"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const schedule_1 = require("@nestjs/schedule");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const app_config_1 = require("./config/app.config");
const auth_config_1 = require("./config/auth.config");
const database_config_1 = require("./config/database.config");
const storage_config_1 = require("./config/storage.config");
const processing_config_1 = require("./config/processing.config");
const cdn_config_1 = require("./config/cdn.config");
const stellar_config_1 = require("./config/stellar.config");
const sms_config_1 = require("./config/sms.config");
const auth_module_1 = require("./auth/auth.module");
const audit_module_1 = require("./audit/audit.module");
const users_module_1 = require("./modules/users/users.module");
const breeds_module_1 = require("./modules/breeds/breeds.module");
const qrcodes_module_1 = require("./modules/qrcodes/qrcodes.module");
const pets_module_1 = require("./modules/pets/pets.module");
const vaccinations_module_1 = require("./modules/vaccinations/vaccinations.module");
const prescriptions_module_1 = require("./modules/prescriptions/prescriptions.module");
const reminders_module_1 = require("./modules/reminders/reminders.module");
const vet_clinics_module_1 = require("./modules/vet-clinics/vet-clinics.module");
const certificates_module_1 = require("./modules/certificates/certificates.module");
const medical_records_module_1 = require("./modules/medical-records/medical-records.module");
const vets_module_1 = require("./modules/vets/vets.module");
const emergency_services_module_1 = require("./modules/emergency-services/emergency-services.module");
const appointment_waitlist_module_1 = require("./modules/appointment-waitlist/appointment-waitlist.module");
const search_module_1 = require("./modules/search/search.module");
const lost_pets_module_1 = require("./modules/lost-pets/lost-pets.module");
const allergies_module_1 = require("./modules/allergies/allergies.module");
const conditions_module_1 = require("./modules/conditions/conditions.module");
const verification_module_1 = require("./modules/verification/verification.module");
const gdpr_module_1 = require("./modules/gdpr/gdpr.module");
const storage_module_1 = require("./modules/storage/storage.module");
const upload_module_1 = require("./modules/upload/upload.module");
const validation_module_1 = require("./modules/validation/validation.module");
const security_module_1 = require("./modules/security/security.module");
const security_module_2 = require("./security/security.module");
const processing_module_1 = require("./modules/processing/processing.module");
const cdn_module_1 = require("./modules/cdn/cdn.module");
const files_module_1 = require("./modules/files/files.module");
const realtime_module_1 = require("./modules/realtime/realtime.module");
const wallets_module_1 = require("./modules/wallets/wallets.module");
const stellar_wallet_management_module_1 = require("./modules/stellar-wallet-management/stellar-wallet-management.module");
const email_module_1 = require("./modules/email/email.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
const analytics_module_1 = require("./modules/analytics/analytics.module");
const sms_module_1 = require("./modules/sms/sms.module");
const websocket_module_1 = require("./websocket/websocket.module");
const database_module_1 = require("./modules/database/database.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [
                    app_config_1.appConfig,
                    auth_config_1.authConfig,
                    database_config_1.databaseConfig,
                    storage_config_1.storageConfig,
                    processing_config_1.processingConfig,
                    cdn_config_1.cdnConfig,
                    stellar_config_1.stellarConfig,
                    sms_config_1.smsConfig,
                ],
                envFilePath: '.env',
            }),
            throttler_1.ThrottlerModule.forRoot([{
                    ttl: 60000,
                    limit: 5,
                }]),
            schedule_1.ScheduleModule.forRoot(),
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (configService) => {
                    const dbConfig = configService.get('database');
                    if (!dbConfig) {
                        throw new Error('Database configuration not found');
                    }
                    return dbConfig;
                },
            }),
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            breeds_module_1.BreedsModule,
            qrcodes_module_1.QRCodesModule,
            pets_module_1.PetsModule,
            vaccinations_module_1.VaccinationsModule,
            prescriptions_module_1.PrescriptionsModule,
            reminders_module_1.RemindersModule,
            vet_clinics_module_1.VetClinicsModule,
            certificates_module_1.CertificatesModule,
            medical_records_module_1.MedicalRecordsModule,
            vets_module_1.VetsModule,
            emergency_services_module_1.EmergencyServicesModule,
            appointment_waitlist_module_1.AppointmentWaitlistModule,
            search_module_1.SearchModule,
            lost_pets_module_1.LostPetsModule,
            allergies_module_1.AllergiesModule,
            conditions_module_1.ConditionsModule,
            audit_module_1.AuditModule,
            verification_module_1.VerificationModule,
            gdpr_module_1.GdprModule,
            storage_module_1.StorageModule,
            upload_module_1.UploadModule,
            validation_module_1.ValidationModule,
            security_module_1.SecurityModule,
            security_module_2.IntrusionDetectionModule,
            processing_module_1.ProcessingModule,
            cdn_module_1.CdnModule,
            files_module_1.FilesModule,
            realtime_module_1.RealtimeModule,
            wallets_module_1.WalletsModule,
            stellar_wallet_management_module_1.StellarWalletManagementModule,
            email_module_1.EmailModule,
            notifications_module_1.NotificationsModule,
            analytics_module_1.AnalyticsModule,
            sms_module_1.SmsModule,
            websocket_module_1.WebSocketModule,
            database_module_1.DatabaseModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map