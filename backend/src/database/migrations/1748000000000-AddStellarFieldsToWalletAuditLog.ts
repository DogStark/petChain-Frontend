import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStellarFieldsToWalletAuditLog1748000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "wallet_audit_logs"
        ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS "ledger" INTEGER NULL,
        ADD COLUMN IF NOT EXISTS "feeCharged" VARCHAR(32) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "wallet_audit_logs"
        DROP COLUMN IF EXISTS "confirmedAt",
        DROP COLUMN IF EXISTS "ledger",
        DROP COLUMN IF EXISTS "feeCharged"
    `);
  }
}
