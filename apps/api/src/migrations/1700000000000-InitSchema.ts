import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial migration — intentional no-op.
 *
 * F0 ships only the bootstrap skeleton; entities (users, links, outbox,
 * api_keys, etc.) land in F1+. This migration exists so that
 * `pnpm migration:run` succeeds at F0 and is idempotent (the
 * typeorm_migrations table records this no-op as run; a second invocation
 * skips it).
 */
export class InitSchema1700000000000 implements MigrationInterface {
  public async up(_queryRunner: QueryRunner): Promise<void> {
    // schema introduced in F1
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // nothing to roll back
  }
}
