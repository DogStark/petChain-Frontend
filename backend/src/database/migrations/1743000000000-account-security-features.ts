import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountSecurityFeatures1743000000000 implements MigrationInterface {
  name = 'AccountSecurityFeatures1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      RENAME COLUMN "passwordResetExpires" TO "passwordResetTokenExpiresAt"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP NULL
    `);

    await queryRunner.query(`
      CREATE TYPE "auth_security_events_eventtype_enum" AS ENUM (
        'PASSWORD_RESET_REQUESTED',
        'PASSWORD_RESET_COMPLETED',
        'ACCOUNT_LOCKED',
        'ACCOUNT_UNLOCKED',
        'SUSPICIOUS_LOGIN',
        'PASSWORD_CHANGED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "login_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "ipAddress" character varying NOT NULL,
        "userAgent" character varying NOT NULL,
        "location" character varying NULL,
        "success" boolean NOT NULL DEFAULT false,
        "anomalyFlag" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_login_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_login_history_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_login_history_user_created"
      ON "login_history" ("userId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE TABLE "auth_security_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "eventType" "auth_security_events_eventtype_enum" NOT NULL,
        "metadata" jsonb NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_security_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_auth_security_events_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_auth_security_events_user_created"
      ON "auth_security_events" ("userId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_auth_security_events_user_created"`);
    await queryRunner.query(`DROP TABLE "auth_security_events"`);

    await queryRunner.query(`DROP INDEX "IDX_login_history_user_created"`);
    await queryRunner.query(`DROP TABLE "login_history"`);

    await queryRunner.query(`DROP TYPE "auth_security_events_eventtype_enum"`);

    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordChangedAt"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      RENAME COLUMN "passwordResetTokenExpiresAt" TO "passwordResetExpires"
    `);
  }
}
