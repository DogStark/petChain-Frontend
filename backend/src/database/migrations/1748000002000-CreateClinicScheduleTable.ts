import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClinicScheduleTable1748000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "clinic_schedules" (
        "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "clinicId"             UUID NOT NULL REFERENCES "vet_clinics"("id") ON DELETE CASCADE,
        "dayOfWeek"            INTEGER NOT NULL CHECK ("dayOfWeek" BETWEEN 0 AND 6),
        "openTime"             VARCHAR(5) NOT NULL,
        "closeTime"            VARCHAR(5) NOT NULL,
        "slotDurationMinutes"  INTEGER NOT NULL DEFAULT 30,
        "createdAt"            TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt"            TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE ("clinicId", "dayOfWeek")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "clinic_schedules"`);
  }
}
