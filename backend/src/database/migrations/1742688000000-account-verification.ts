import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountVerification1742688000000 implements MigrationInterface {
  name = 'AccountVerification1742688000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "phoneVerified" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "phoneVerificationCode" character varying NULL,
      ADD COLUMN IF NOT EXISTS "phoneVerificationExpires" TIMESTAMP NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "phoneVerificationExpires",
      DROP COLUMN IF EXISTS "phoneVerificationCode",
      DROP COLUMN IF EXISTS "phoneVerified"
    `);
  }
}
