import { MigrationInterface, QueryRunner } from 'typeorm';

const CREATE_API_KEYS_SQL = `
CREATE TABLE "api_keys" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      UUID        NOT NULL,
  "label"        VARCHAR(64) NOT NULL,
  "key_hash"     VARCHAR(72) NOT NULL,
  "key_prefix"   CHAR(8)     NOT NULL,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "last_used_at" TIMESTAMP   NULL,
  "revoked_at"   TIMESTAMP   NULL,
  CONSTRAINT "PK_api_keys_id"   PRIMARY KEY ("id"),
  CONSTRAINT "FK_api_keys_user" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE
)
`;

const CREATE_INDEX_PREFIX_SQL = `
  CREATE INDEX "IDX_api_keys_key_prefix"
  ON "api_keys" ("key_prefix")
`;

const CREATE_INDEX_USER_REVOKED_SQL = `
  CREATE INDEX "IDX_api_keys_user_revoked"
  ON "api_keys" ("user_id", "revoked_at")
`;

const DROP_TABLE_SQL = `DROP TABLE IF EXISTS "api_keys"`;
const DROP_INDEX_PREFIX_SQL = `DROP INDEX IF EXISTS "IDX_api_keys_key_prefix"`;
const DROP_INDEX_USER_REVOKED_SQL = `DROP INDEX IF EXISTS "IDX_api_keys_user_revoked"`;

export class CreateApiKeys1700000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(CREATE_API_KEYS_SQL);
    await queryRunner.query(CREATE_INDEX_PREFIX_SQL);
    await queryRunner.query(CREATE_INDEX_USER_REVOKED_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DROP_INDEX_USER_REVOKED_SQL);
    await queryRunner.query(DROP_INDEX_PREFIX_SQL);
    await queryRunner.query(DROP_TABLE_SQL);
  }
}
