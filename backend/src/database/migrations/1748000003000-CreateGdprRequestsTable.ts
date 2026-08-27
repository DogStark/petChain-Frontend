import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGdprRequestsTable1748000003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS "gdpr_request_type_enum" AS ENUM ('EXPORT', 'ERASURE')
    `).catch(() => {});
    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS "gdpr_request_status_enum" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')
    `).catch(() => {});
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gdpr_requests" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"      UUID NOT NULL,
        "type"        "gdpr_request_type_enum" NOT NULL,
        "status"      "gdpr_request_status_enum" NOT NULL DEFAULT 'PENDING',
        "downloadUrl" TEXT NULL,
        "requestedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "completedAt" TIMESTAMP NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_gdpr_requests_user_type"
        ON "gdpr_requests" ("userId", "type", "requestedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "gdpr_requests"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "gdpr_request_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "gdpr_request_type_enum"`);
  }
}
