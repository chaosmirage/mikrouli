import { MigrationInterface, QueryRunner } from 'typeorm';

const CREATE_PROVIDER_ACCOUNTS_SQL = `
CREATE TABLE "provider_accounts" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "provider"         VARCHAR(32)  NOT NULL,
  "provider_user_id" VARCHAR(255) NOT NULL,
  "user_id"          UUID         NOT NULL,
  "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "PK_provider_accounts_id"       PRIMARY KEY ("id"),
  CONSTRAINT "FK_provider_accounts_user"     FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "UQ_provider_accounts_identity" UNIQUE ("provider", "provider_user_id"),
  CONSTRAINT "UQ_provider_accounts_user"     UNIQUE ("provider", "user_id")
)
`;

// Allows GitHub-only accounts (no password credential).
// Down migration restores NOT NULL — this intentionally blocks the down
// migration if any password-less users exist, preventing silent data loss.
const ALTER_PASSWORD_HASH_NULLABLE_SQL = `
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL
`;

const ALTER_PASSWORD_HASH_NOT_NULL_SQL = `
ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL
`;

const DROP_PROVIDER_ACCOUNTS_SQL = `DROP TABLE IF EXISTS "provider_accounts"`;

export class GithubIdentities1700000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(CREATE_PROVIDER_ACCOUNTS_SQL);
    await queryRunner.query(ALTER_PASSWORD_HASH_NULLABLE_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SET NOT NULL runs before DROP TABLE so the constraint enforces that no
    // password-less users exist before the provider_accounts table is removed.
    await queryRunner.query(ALTER_PASSWORD_HASH_NOT_NULL_SQL);
    await queryRunner.query(DROP_PROVIDER_ACCOUNTS_SQL);
  }
}
