import { MigrationInterface, QueryRunner } from 'typeorm';

const CREATE_USERS_SQL = `
CREATE TABLE "users" (
  "id"            UUID                     NOT NULL DEFAULT gen_random_uuid(),
  "email"         VARCHAR(255)             NOT NULL,
  "password_hash" VARCHAR(72)              NOT NULL,
  "created_at"    TIMESTAMPTZ              NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ              NOT NULL DEFAULT now(),
  CONSTRAINT "PK_users_id"    PRIMARY KEY ("id"),
  CONSTRAINT "UQ_users_email" UNIQUE      ("email")
)
`;

const DROP_USERS_SQL = `DROP TABLE "users"`;

export class CreateUsers1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(CREATE_USERS_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DROP_USERS_SQL);
  }
}
