import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSearchVectorColumns1700000000000 implements MigrationInterface {
  name = 'AddSearchVectorColumns1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ----------------------------------------------------------------
    // 1. pets — add search_vector GENERATED ALWAYS AS STORED column
    // ----------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "pets"
        ADD COLUMN IF NOT EXISTS "search_vector" tsvector
          GENERATED ALWAYS AS (
            setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
            setweight(to_tsvector('english', coalesce("species"::text, '')), 'B') ||
            setweight(to_tsvector('english', coalesce("color", '')), 'C') ||
            setweight(to_tsvector('english', coalesce("microchip_id", '')), 'C')
          ) STORED
    `);

    // ----------------------------------------------------------------
    // 2. vets — add latitude, longitude, and search_vector columns
    // ----------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "vets"
        ADD COLUMN IF NOT EXISTS "latitude"  DECIMAL(9,6) NULL,
        ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(9,6) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "vets"
        ADD COLUMN IF NOT EXISTS "search_vector" tsvector
          GENERATED ALWAYS AS (
            setweight(to_tsvector('english', coalesce("vetName", '')), 'A') ||
            setweight(to_tsvector('english', coalesce("clinicName", '')), 'A') ||
            setweight(to_tsvector('english', coalesce("city", '')), 'B') ||
            setweight(to_tsvector('english', coalesce("state", '')), 'B') ||
            setweight(to_tsvector('english', coalesce("address", '')), 'C')
          ) STORED
    `);

    // ----------------------------------------------------------------
    // 3. medical_records — add search_vector GENERATED ALWAYS AS STORED
    // ----------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "medical_records"
        ADD COLUMN IF NOT EXISTS "search_vector" tsvector
          GENERATED ALWAYS AS (
            setweight(to_tsvector('english', coalesce("diagnosis", '')), 'A') ||
            setweight(to_tsvector('english', coalesce("treatment", '')), 'A') ||
            setweight(to_tsvector('english', coalesce("notes", '')), 'B') ||
            setweight(to_tsvector('english', coalesce("recordType"::text, '')), 'C')
          ) STORED
    `);

    // ----------------------------------------------------------------
    // 4. GIN indexes for fast full-text search
    // ----------------------------------------------------------------
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_pets_search_vector"
        ON "pets" USING GIN ("search_vector")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_vets_search_vector"
        ON "vets" USING GIN ("search_vector")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_medical_records_search_vector"
        ON "medical_records" USING GIN ("search_vector")
    `);

    // ----------------------------------------------------------------
    // 5. Backfill existing rows — no-op UPDATE triggers GENERATED column
    //    population for any rows that existed before this migration ran.
    // ----------------------------------------------------------------
    await queryRunner.query(`UPDATE "pets" SET "name" = "name"`);
    await queryRunner.query(`UPDATE "vets" SET "vetName" = "vetName"`);
    await queryRunner.query(`UPDATE "medical_records" SET "diagnosis" = "diagnosis"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop GIN indexes first
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_medical_records_search_vector"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_vets_search_vector"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pets_search_vector"`);

    // Drop search_vector columns
    await queryRunner.query(`ALTER TABLE "medical_records" DROP COLUMN IF EXISTS "search_vector"`);
    await queryRunner.query(`ALTER TABLE "vets" DROP COLUMN IF EXISTS "search_vector"`);
    await queryRunner.query(`ALTER TABLE "pets" DROP COLUMN IF EXISTS "search_vector"`);

    // Drop lat/lng columns from vets
    await queryRunner.query(`ALTER TABLE "vets" DROP COLUMN IF EXISTS "longitude"`);
    await queryRunner.query(`ALTER TABLE "vets" DROP COLUMN IF EXISTS "latitude"`);
  }
}
