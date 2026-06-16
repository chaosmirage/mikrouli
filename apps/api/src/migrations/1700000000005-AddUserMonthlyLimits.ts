import { MigrationInterface, QueryRunner } from 'typeorm';

const ADD_MONTHLY_LIMIT_COLUMNS_SQL = `
ALTER TABLE "users"
  ADD COLUMN "monthly_link_limit" INTEGER,
  ADD COLUMN "monthly_key_limit" INTEGER
`;

const DROP_MONTHLY_LIMIT_COLUMNS_SQL = `
ALTER TABLE "users"
  DROP COLUMN "monthly_link_limit",
  DROP COLUMN "monthly_key_limit"
`;

export class AddUserMonthlyLimits1700000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(ADD_MONTHLY_LIMIT_COLUMNS_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DROP_MONTHLY_LIMIT_COLUMNS_SQL);
  }
}
