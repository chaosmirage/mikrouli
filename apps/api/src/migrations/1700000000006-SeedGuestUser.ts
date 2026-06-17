import { MigrationInterface, QueryRunner } from 'typeorm';
import { GUEST_SENTINEL_EMAIL } from '../common/constants';

// Idempotent seed of the single shared Guest pseudo-identity row. Every
// anonymous visitor draws from this one row when GUEST_SHORTEN_ENABLED is on;
// password_hash stays NULL so the decoy login path in auth.service can never
// admit it. ON CONFLICT (email) DO NOTHING makes re-running the migration a
// safe no-op.
const SEED_GUEST_USER_SQL = `
INSERT INTO "users" (id, email, password_hash)
VALUES (gen_random_uuid(), $1, NULL)
ON CONFLICT (email) DO NOTHING
`;

export class SeedGuestUser1700000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(SEED_GUEST_USER_SQL, [GUEST_SENTINEL_EMAIL]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "users" WHERE email = $1`, [GUEST_SENTINEL_EMAIL]);
  }
}
