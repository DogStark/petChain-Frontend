import { MigrationInterface, QueryRunner } from 'typeorm';

export class VaccinationsSchemaAndReactions1739200000000
  implements MigrationInterface
{
  name = 'VaccinationsSchemaAndReactions1739200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vaccinations' AND column_name = 'petId'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vaccinations' AND column_name = 'pet_id'
        ) THEN
          ALTER TABLE "vaccinations" RENAME COLUMN "petId" TO "pet_id";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vaccinations' AND column_name = 'vaccineName'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vaccinations' AND column_name = 'vaccine_name'
        ) THEN
          ALTER TABLE "vaccinations" RENAME COLUMN "vaccineName" TO "vaccine_name";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vaccinations' AND column_name = 'batchNumber'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vaccinations' AND column_name = 'batch_number'
        ) THEN
          ALTER TABLE "vaccinations" RENAME COLUMN "batchNumber" TO "batch_number";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vaccinations' AND column_name = 'administeredDate'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vaccinations' AND column_name = 'date_administered'
        ) THEN
          ALTER TABLE "vaccinations" RENAME COLUMN "administeredDate" TO "date_administered";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vaccinations' AND column_name = 'nextDueDate'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vaccinations' AND column_name = 'next_due_date'
        ) THEN
          ALTER TABLE "vaccinations" RENAME COLUMN "nextDueDate" TO "next_due_date";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vaccinations' AND column_name = 'createdAt'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vaccinations' AND column_name = 'created_at'
        ) THEN
          ALTER TABLE "vaccinations" RENAME COLUMN "createdAt" TO "created_at";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "vaccinations"
      ADD COLUMN IF NOT EXISTS "vet_id" uuid NULL,
      ADD COLUMN IF NOT EXISTS "manufacturer" character varying NULL,
      ADD COLUMN IF NOT EXISTS "site" character varying NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaccinations_pet_id" ON "vaccinations" ("pet_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaccinations_vet_id" ON "vaccinations" ("vet_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaccinations_next_due_date" ON "vaccinations" ("next_due_date")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_vaccinations_vet_id'
            AND table_name = 'vaccinations'
        ) THEN
          ALTER TABLE "vaccinations"
          ADD CONSTRAINT "FK_vaccinations_vet_id"
          FOREIGN KEY ("vet_id") REFERENCES "vets"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vaccination_adverse_reactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "vaccination_id" uuid NOT NULL,
        "reaction" character varying NOT NULL,
        "severity" character varying NULL,
        "onset_at" TIMESTAMP NULL,
        "notes" text NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vaccination_adverse_reactions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_vaccination_adverse_reactions_vaccination"
          FOREIGN KEY ("vaccination_id") REFERENCES "vaccinations"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaccination_adverse_reactions_vaccination_id"
      ON "vaccination_adverse_reactions" ("vaccination_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_vaccination_adverse_reactions_vaccination_id"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "vaccination_adverse_reactions"
    `);
    await queryRunner.query(`
      ALTER TABLE "vaccinations" DROP CONSTRAINT IF EXISTS "FK_vaccinations_vet_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_vaccinations_next_due_date"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_vaccinations_vet_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_vaccinations_pet_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "vaccinations"
      DROP COLUMN IF EXISTS "site",
      DROP COLUMN IF EXISTS "manufacturer",
      DROP COLUMN IF EXISTS "vet_id"
    `);
  }
}
