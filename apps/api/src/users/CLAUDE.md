# users

## Purpose

Owns the `users` table and the `provider_accounts` table. Provides the
persistence layer for account creation (credential and OAuth), email-based
lookup, and transactional find-or-create-or-link for OAuth sign-in.

## Key pieces

- `user.entity.ts` -- `users` table. `passwordHash` is `string | null`
  (nullable): null for OAuth-only accounts that were never given a password.
  The strict union (not optional) forces every caller to narrow the null case
  at compile time.
- `provider-account.entity.ts` -- `provider_accounts` table. One row per
  (provider, user) pair, enforced by unique constraints at the database level.
  The `provider` column is a string-literal union (`'github'`); extend it when
  adding a new provider. `ON DELETE CASCADE` mirrors the pattern used by
  `api_key.entity.ts`: removing a user automatically removes all its OAuth
  links.
- `users.service.ts` -- `UsersService`:
  - `create(params)` -- inserts a new user; on a duplicate-email `23505`
    violation returns an indistinguishable decoy response (same shape, new
    UUID, not persisted) to prevent account-existence enumeration.
  - `findOrCreateFromProvider(params)` -- transactional three-branch
    resolution for OAuth sign-in: (1) returning user whose provider link
    already exists, (2) existing account matched by verified email (links the
    provider), (3) first-time sign-up (inserts user with null passwordHash and
    inserts the provider link). On a concurrent `23505` violation the
    transaction is retried exactly once; the second pass deterministically hits
    branch 1 or 2.
- `users.module.ts` -- exports `UsersService` and `TypeOrmModule` for
  `User` and `ProviderAccount`; consumed by `AuthModule`.

## How to extend safely

- `passwordHash` is nullable by design. Never assert it is non-null without
  first checking; `validateCredentials` in `auth.service.ts` guards this with
  a constant-time decoy compare.
- To add a new OAuth provider, extend the `provider` column union in
  `provider-account.entity.ts` and write a migration. The three-branch
  resolution in `resolveProviderIdentity` is provider-agnostic and requires no
  changes.
- `saveOrDecoy` must remain the only write path for `create`; do not call
  `repo.save` directly for new user rows, as that would expose duplicate-email
  errors to the caller.
- The retry-once pattern in `findOrCreateFromProvider` depends on the
  transaction running `SERIALIZABLE` isolation implicitly via TypeORM's default
  `READ COMMITTED` and the unique constraints. Do not replace the retry with
  an upsert unless you verify the enumeration properties are preserved.
- Any schema change requires a new migration file in `apps/api/src/migrations/`;
  never edit the entity and skip the migration.
