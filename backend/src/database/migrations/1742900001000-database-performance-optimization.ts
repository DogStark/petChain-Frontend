import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * Database Performance Optimization - Indexes
 *
 * This migration adds critical indexes to optimize query performance
 * across the most frequently queried tables and columns.
 */
export class DatabasePerformanceOptimization1742900001000 implements MigrationInterface {
  name = 'DatabasePerformanceOptimization1742900001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== USERS TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_isActive" ON "users" ("isActive")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_createdAt" ON "users" ("createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_lastLogin" ON "users" ("lastLogin" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_email_verified" ON "users" ("emailVerified")
    `);

    // ==================== PETS TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pets_owner_id" ON "pets" ("owner_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pets_breed_id" ON "pets" ("breed_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pets_species" ON "pets" ("species")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pets_gender" ON "pets" ("gender")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pets_neutered" ON "pets" ("neutered")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pets_createdAt" ON "pets" ("createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pets_deletedAt" ON "pets" ("deleted_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pets_microchip_id" ON "pets" ("microchip_id")
    `);
    // Composite index for common query pattern
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pets_owner_deleted" ON "pets" ("owner_id", "deleted_at")
    `);

    // ==================== PET_SHARES TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pet_shares_shared_with_user" ON "pet_shares" ("shared_with_user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pet_shares_shared_by_user" ON "pet_shares" ("shared_by_user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pet_shares_isActive" ON "pet_shares" ("is_active")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pet_shares_pet_user_active" ON "pet_shares" ("pet_id", "shared_with_user_id", "is_active")
    `);

    // ==================== MEDICAL_RECORDS TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_medical_records_petId" ON "medical_records" ("petId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_medical_records_vetId" ON "medical_records" ("vetId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_medical_records_recordType" ON "medical_records" ("recordType")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_medical_records_visitDate" ON "medical_records" ("visit_date" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_medical_records_verified" ON "medical_records" ("verified")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_medical_records_deletedAt" ON "medical_records" ("deletedAt")
    `);
    // Composite index for common query pattern
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_medical_records_pet_visit" ON "medical_records" ("petId", "visit_date" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_medical_records_pet_type" ON "medical_records" ("petId", "recordType")
    `);

    // ==================== VACCINATIONS TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaccinations_pet_id" ON "vaccinations" ("pet_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaccinations_vet_id" ON "vaccinations" ("vet_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaccinations_vetClinicId" ON "vaccinations" ("vetClinicId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaccinations_date_administered" ON "vaccinations" ("date_administered" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaccinations_next_due_date" ON "vaccinations" ("next_due_date")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaccinations_certificate_code" ON "vaccinations" ("certificateCode")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaccinations_reminder_sent" ON "vaccinations" ("reminderSent")
    `);
    // Composite index for reminder queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaccinations_pet_due" ON "vaccinations" ("pet_id", "next_due_date")
    `);

    // ==================== VACCINATION_SCHEDULES TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaccination_schedules_breed" ON "vaccination_schedules" ("breedId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaccination_schedules_vaccine" ON "vaccination_schedules" ("vaccineName")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaccination_schedules_active" ON "vaccination_schedules" ("isActive")
    `);

    // ==================== VETS TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vets_user_id" ON "vets" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vets_clinic_id" ON "vets" ("clinicId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vets_isActive" ON "vets" ("isActive")
    `);

    // ==================== VET_CLINICS TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vet_clinics_owner_id" ON "vet_clinics" ("owner_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vet_clinics_isActive" ON "vet_clinics" ("isActive")
    `);

    // ==================== APPOINTMENTS TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_appointments_pet_id" ON "appointments" ("pet_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_appointments_vet_id" ON "appointments" ("vet_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_appointments_clinic_id" ON "appointments" ("clinic_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_appointments_user_id" ON "appointments" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_appointments_status" ON "appointments" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_appointments_datetime" ON "appointments" ("appointmentDateTime" DESC)
    `);
    // Composite index for common query pattern
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_appointments_vet_status" ON "appointments" ("vet_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_appointments_pet_status" ON "appointments" ("pet_id", "status")
    `);

    // ==================== REMINDERS TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reminders_pet_id" ON "reminders" ("petId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reminders_user_id" ON "reminders" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reminders_type" ON "reminders" ("type")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reminders_status" ON "reminders" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reminders_due_date" ON "reminders" ("dueDate")
    `);
    // Composite index for active reminders
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reminders_user_status" ON "reminders" ("userId", "status")
    `);

    // ==================== PRESCRIPTIONS TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prescriptions_pet_id" ON "prescriptions" ("petId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prescriptions_vet_id" ON "prescriptions" ("vetId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prescriptions_status" ON "prescriptions" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prescriptions_createdAt" ON "prescriptions" ("createdAt" DESC)
    `);

    // ==================== PET_PHOTOS TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pet_photos_pet_id" ON "pet_photos" ("petId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pet_photos_isPrimary" ON "pet_photos" ("isPrimary")
    `);

    // ==================== BREEDS TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_breeds_species" ON "breeds" ("species")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_breeds_name" ON "breeds" ("name")
    `);

    // ==================== QR_CODES TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_qrcodes_pet_id" ON "qrcodes" ("petId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_qrcodes_user_id" ON "qrcodes" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_qrcodes_code" ON "qrcodes" ("code")
    `);

    // ==================== LOST_PET_REPORTS TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lost_pets_pet_id" ON "lost_pet_reports" ("petId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lost_pets_user_id" ON "lost_pet_reports" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lost_pets_status" ON "lost_pet_reports" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lost_pets_createdAt" ON "lost_pet_reports" ("createdAt" DESC)
    `);

    // ==================== NOTIFICATIONS TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_user_id" ON "notifications" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_type" ON "notifications" ("type")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_read" ON "notifications" ("read")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_createdAt" ON "notifications" ("createdAt" DESC)
    `);
    // Composite index for unread notifications
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_user_read" ON "notifications" ("userId", "read")
    `);

    // ==================== DEVICE_TOKENS TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_device_tokens_user_id" ON "device_tokens" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_device_tokens_isActive" ON "device_tokens" ("isActive")
    `);

    // ==================== AUDIT_LOGS TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_user_id" ON "audit_logs" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_entity" ON "audit_logs" ("entityType", "entityId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_action" ON "audit_logs" ("action")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_timestamp" ON "audit_logs" ("timestamp" DESC)
    `);
    // Composite index for common query pattern
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_user_entity" ON "audit_logs" ("userId", "entityType", "timestamp" DESC)
    `);

    // ==================== API_KEYS TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_api_keys_user_id" ON "api_keys" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_api_keys_key_hash" ON "api_keys" ("keyHash")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_api_keys_isActive" ON "api_keys" ("isActive")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_api_keys_expires_at" ON "api_keys" ("expiresAt")
    `);

    // ==================== WEIGHT_ENTRIES TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_weight_entries_pet_id" ON "weight_entries" ("petId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_weight_entries_recorded_at" ON "weight_entries" ("recordedAt" DESC)
    `);
    // Composite index for common query pattern
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_weight_entries_pet_recorded" ON "weight_entries" ("petId", "recordedAt" DESC)
    `);

    // ==================== SURGERIES TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_surgeries_pet_id" ON "surgeries" ("petId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_surgeries_vet_id" ON "surgeries" ("vetId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_surgeries_surgery_date" ON "surgeries" ("surgeryDate" DESC)
    `);

    // ==================== CONDITIONS TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conditions_pet_id" ON "conditions" ("petId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conditions_isActive" ON "conditions" ("isActive")
    `);

    // ==================== ALLERGIES TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_allergies_pet_id" ON "allergies" ("petId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_allergies_severity" ON "allergies" ("severity")
    `);

    // ==================== RECORD_SHARES TABLE ====================
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_record_shares_record_id" ON "record_shares" ("recordId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_record_shares_shared_with" ON "record_shares" ("sharedWithUserId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_record_shares_shared_by" ON "record_shares" ("sharedByUserId")
    `);

    // ==================== PERFORMANCE ANALYSIS ====================
    // Enable pg_stat_statements for query performance monitoring (if not already enabled)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
          CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all indexes created by this migration
    const indexesToDrop = [
      // Users
      'IDX_users_email',
      'IDX_users_isActive',
      'IDX_users_createdAt',
      'IDX_users_lastLogin',
      'IDX_users_email_verified',
      // Pets
      'IDX_pets_owner_id',
      'IDX_pets_breed_id',
      'IDX_pets_species',
      'IDX_pets_gender',
      'IDX_pets_neutered',
      'IDX_pets_createdAt',
      'IDX_pets_deletedAt',
      'IDX_pets_microchip_id',
      'IDX_pets_owner_deleted',
      // Pet Shares
      'IDX_pet_shares_shared_with_user',
      'IDX_pet_shares_shared_by_user',
      'IDX_pet_shares_isActive',
      'IDX_pet_shares_pet_user_active',
      // Medical Records
      'IDX_medical_records_petId',
      'IDX_medical_records_vetId',
      'IDX_medical_records_recordType',
      'IDX_medical_records_visitDate',
      'IDX_medical_records_verified',
      'IDX_medical_records_deletedAt',
      'IDX_medical_records_pet_visit',
      'IDX_medical_records_pet_type',
      // Vaccinations
      'IDX_vaccinations_pet_id',
      'IDX_vaccinations_vet_id',
      'IDX_vaccinations_vetClinicId',
      'IDX_vaccinations_date_administered',
      'IDX_vaccinations_next_due_date',
      'IDX_vaccinations_certificate_code',
      'IDX_vaccinations_reminder_sent',
      'IDX_vaccinations_pet_due',
      // Vaccination Schedules
      'IDX_vaccination_schedules_breed',
      'IDX_vaccination_schedules_vaccine',
      'IDX_vaccination_schedules_active',
      // Vets
      'IDX_vets_user_id',
      'IDX_vets_clinic_id',
      'IDX_vets_isActive',
      // Vet Clinics
      'IDX_vet_clinics_owner_id',
      'IDX_vet_clinics_isActive',
      // Appointments
      'IDX_appointments_pet_id',
      'IDX_appointments_vet_id',
      'IDX_appointments_clinic_id',
      'IDX_appointments_user_id',
      'IDX_appointments_status',
      'IDX_appointments_datetime',
      'IDX_appointments_vet_status',
      'IDX_appointments_pet_status',
      // Reminders
      'IDX_reminders_pet_id',
      'IDX_reminders_user_id',
      'IDX_reminders_type',
      'IDX_reminders_status',
      'IDX_reminders_due_date',
      'IDX_reminders_user_status',
      // Prescriptions
      'IDX_prescriptions_pet_id',
      'IDX_prescriptions_vet_id',
      'IDX_prescriptions_status',
      'IDX_prescriptions_createdAt',
      // Pet Photos
      'IDX_pet_photos_pet_id',
      'IDX_pet_photos_isPrimary',
      // Breeds
      'IDX_breeds_species',
      'IDX_breeds_name',
      // QR Codes
      'IDX_qrcodes_pet_id',
      'IDX_qrcodes_user_id',
      'IDX_qrcodes_code',
      // Lost Pets
      'IDX_lost_pets_pet_id',
      'IDX_lost_pets_user_id',
      'IDX_lost_pets_status',
      'IDX_lost_pets_createdAt',
      // Notifications
      'IDX_notifications_user_id',
      'IDX_notifications_type',
      'IDX_notifications_read',
      'IDX_notifications_createdAt',
      'IDX_notifications_user_read',
      // Device Tokens
      'IDX_device_tokens_user_id',
      'IDX_device_tokens_isActive',
      // Audit Logs
      'IDX_audit_logs_user_id',
      'IDX_audit_logs_entity',
      'IDX_audit_logs_action',
      'IDX_audit_logs_timestamp',
      'IDX_audit_logs_user_entity',
      // API Keys
      'IDX_api_keys_user_id',
      'IDX_api_keys_key_hash',
      'IDX_api_keys_isActive',
      'IDX_api_keys_expires_at',
      // Weight Entries
      'IDX_weight_entries_pet_id',
      'IDX_weight_entries_recorded_at',
      'IDX_weight_entries_pet_recorded',
      // Surgeries
      'IDX_surgeries_pet_id',
      'IDX_surgeries_vet_id',
      'IDX_surgeries_surgery_date',
      // Conditions
      'IDX_conditions_pet_id',
      'IDX_conditions_isActive',
      // Allergies
      'IDX_allergies_pet_id',
      'IDX_allergies_severity',
      // Record Shares
      'IDX_record_shares_record_id',
      'IDX_record_shares_shared_with',
      'IDX_record_shares_shared_by',
    ];

    for (const indexName of indexesToDrop) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${indexName}"`);
    }

    // Disable pg_stat_statements (optional, usually kept enabled)
    await queryRunner.query(`DROP EXTENSION IF EXISTS pg_stat_statements`);
  }
}
