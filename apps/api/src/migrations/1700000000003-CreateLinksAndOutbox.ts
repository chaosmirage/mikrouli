import { MigrationInterface, QueryRunner } from 'typeorm';

const CREATE_LINKS_SQL = `
CREATE TABLE "links" (
  "short_url"    CHAR(6)       NOT NULL,
  "original_url" VARCHAR(8192) NOT NULL,
  "user_id"      UUID          NOT NULL,
  "created_at"   TIMESTAMP     NOT NULL DEFAULT now(),
  "expires_at"   TIMESTAMP     NULL,
  CONSTRAINT "PK_links_short_url" PRIMARY KEY ("short_url"),
  CONSTRAINT "FK_links_user"      FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE
)
`;

const CREATE_LINKS_EXPIRES_INDEX_SQL = `
CREATE INDEX "IDX_links_expires_at" ON "links" ("expires_at")
`;

const CREATE_OUTBOX_SQL = `
CREATE TABLE "outbox" (
  "id"             UUID      NOT NULL DEFAULT gen_random_uuid(),
  "aggregate_type" VARCHAR   NOT NULL,
  "payload"        JSONB     NOT NULL,
  "created_at"     TIMESTAMP NOT NULL DEFAULT now(),
  "processed_at"   TIMESTAMP NULL,
  CONSTRAINT "PK_outbox_id" PRIMARY KEY ("id")
)
`;

const CREATE_OUTBOX_PENDING_INDEX_SQL = `
CREATE INDEX "IDX_outbox_pending"
  ON "outbox" ("processed_at")
  WHERE processed_at IS NULL
`;

const DROP_LINKS_SQL = `DROP TABLE IF EXISTS "links"`;
const DROP_OUTBOX_SQL = `DROP TABLE IF EXISTS "outbox"`;
const DROP_LINKS_EXPIRES_INDEX_SQL = `DROP INDEX IF EXISTS "IDX_links_expires_at"`;
const DROP_OUTBOX_PENDING_INDEX_SQL = `DROP INDEX IF EXISTS "IDX_outbox_pending"`;

export class CreateLinksAndOutbox1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(CREATE_LINKS_SQL);
    await queryRunner.query(CREATE_LINKS_EXPIRES_INDEX_SQL);
    await queryRunner.query(CREATE_OUTBOX_SQL);
    await queryRunner.query(CREATE_OUTBOX_PENDING_INDEX_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DROP_LINKS_EXPIRES_INDEX_SQL);
    await queryRunner.query(DROP_LINKS_SQL);
    await queryRunner.query(DROP_OUTBOX_PENDING_INDEX_SQL);
    await queryRunner.query(DROP_OUTBOX_SQL);
  }
}
