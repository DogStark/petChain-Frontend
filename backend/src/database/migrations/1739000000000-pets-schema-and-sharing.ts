import { MigrationInterface, QueryRunner } from 'typeorm';

export class PetsSchemaAndSharing1739000000000 implements MigrationInterface {
  name = 'PetsSchemaAndSharing1739000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Align existing pets columns to required snake_case schema.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'pets' AND column_name = 'ownerId'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'pets' AND column_name = 'owner_id'
        ) THEN
          ALTER TABLE "pets" RENAME COLUMN "ownerId" TO "owner_id";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'pets' AND column_name = 'breedId'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'pets' AND column_name = 'breed_id'
        ) THEN
          ALTER TABLE "pets" RENAME COLUMN "breedId" TO "breed_id";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'pets' AND column_name = 'dateOfBirth'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'pets' AND column_name = 'date_of_birth'
        ) THEN
          ALTER TABLE "pets" RENAME COLUMN "dateOfBirth" TO "date_of_birth";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'pets' AND column_name = 'microchipNumber'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'pets' AND column_name = 'microchip_id'
        ) THEN
          ALTER TABLE "pets" RENAME COLUMN "microchipNumber" TO "microchip_id";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'pets' AND column_name = 'insurancePolicy'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'pets' AND column_name = 'insurance_policy'
        ) THEN
          ALTER TABLE "pets" RENAME COLUMN "insurancePolicy" TO "insurance_policy";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'pets' AND column_name = 'createdAt'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'pets' AND column_name = 'created_at'
        ) THEN
          ALTER TABLE "pets" RENAME COLUMN "createdAt" TO "created_at";
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'pets' AND column_name = 'updatedAt'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'pets' AND column_name = 'updated_at'
        ) THEN
          ALTER TABLE "pets" RENAME COLUMN "updatedAt" TO "updated_at";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "pets"
      ADD COLUMN IF NOT EXISTS "neutered" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pet_shares" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "pet_id" uuid NOT NULL,
        "shared_with_user_id" uuid NOT NULL,
        "shared_by_user_id" uuid NOT NULL,
        "can_edit" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pet_shares_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_pet_shares_pet_user" UNIQUE ("pet_id", "shared_with_user_id"),
        CONSTRAINT "FK_pet_shares_pet" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pet_shares_shared_with_user" FOREIGN KEY ("shared_with_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pet_shares_shared_by_user" FOREIGN KEY ("shared_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pet_shares_pet_id" ON "pet_shares" ("pet_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pet_shares_shared_with_user_id" ON "pet_shares" ("shared_with_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pet_shares_shared_with_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pet_shares_pet_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pet_shares"`);
  }
}
