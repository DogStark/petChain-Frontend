import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBehaviorLogsTable1743100000000 implements MigrationInterface {
  name = 'CreateBehaviorLogsTable1743100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "behavior_logs_category_enum" AS ENUM (
        'Aggression',
        'Anxiety',
        'Lethargy',
        'Excessive barking/meowing',
        'Destructive behavior',
        'Appetite changes',
        'Sleep changes',
        'Other'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "behavior_logs_severity_enum" AS ENUM (
        'Low',
        'Medium',
        'High',
        'Critical'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "behavior_logs" (
        "id"              uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "pet_id"          uuid              NOT NULL,
        "category"        "behavior_logs_category_enum" NOT NULL,
        "severity"        "behavior_logs_severity_enum" NOT NULL DEFAULT 'Low',
        "description"     text              NOT NULL,
        "date"            TIMESTAMP         NOT NULL,
        "duration"        character varying,
        "triggers"        text,
        "location"        character varying,
        "shared_with_vet" boolean           NOT NULL DEFAULT false,
        "created_at"      TIMESTAMP         NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_behavior_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_behavior_logs_pet" FOREIGN KEY ("pet_id")
          REFERENCES "pets"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_behavior_logs_pet_id" ON "behavior_logs" ("pet_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_behavior_logs_date" ON "behavior_logs" ("date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_behavior_logs_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_behavior_logs_pet_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "behavior_logs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "behavior_logs_severity_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "behavior_logs_category_enum"`);
  }
}
