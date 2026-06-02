import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePetSightingsTable1748000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pet_sightings" (
        "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "lostPetReportId"   UUID NOT NULL REFERENCES "lost_pet_reports"("id") ON DELETE CASCADE,
        "reportedByUserId"  UUID NOT NULL,
        "lat"               DECIMAL(10,7) NOT NULL,
        "lng"               DECIMAL(10,7) NOT NULL,
        "description"       TEXT NULL,
        "photoUrl"          TEXT NULL,
        "reportedAt"        TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pet_sightings_report"
        ON "pet_sightings" ("lostPetReportId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "pet_sightings"`);
  }
}
