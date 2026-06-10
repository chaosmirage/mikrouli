# 0010 - Expired-Link Lifecycle: 410 Gone and Hourly Batch Cleanup

**Status:** Accepted

## Context

Links in the system have an optional expiry timestamp (`expiresAt`). Once a
link expires, two behaviors need to be defined:

1. **What HTTP response does an expired slug receive at redirect time?**
   A 404 Not Found would be misleading: the slug did exist and might have been
   bookmarked or shared. A 301 Moved Permanently is incorrect because the
   destination is no longer valid. HTTP 410 Gone is the semantically correct
   status: the resource existed and has been permanently removed.

2. **How are expired rows removed from the database and cache?**
   Leaving expired rows in Postgres indefinitely causes table bloat. Deleting
   them synchronously on first access adds latency to the 410 response path.
   A background job that periodically sweeps expired rows separates the cleanup
   concern from the serving path.

Evidence:
- `apps/api/src/redirect/redirect.controller.ts`: when `resolution.status ===
  'expired'`, throws a `GoneException` (HTTP 410).
- `apps/api/src/redirect/redirect.service.ts`: `isExpired(link)` checks
  `link.expiresAt.getTime() <= Date.now()`.
- `apps/api/src/cleanup/cleanup.service.ts`: the `@Cron('0 * * * *')` decorator
  runs `handleCleanup` hourly. It finds expired links in batches of 1,000,
  deletes each from Postgres, and invalidates the corresponding Redis cache
  entry via `linkCache.del(slug)`. Per-item errors are caught and logged; a
  failure on one slug does not abort the batch.

## Decision

Define a two-part lifecycle for expired links:

1. **At serve time:** the redirect service checks `expiresAt` on every cache
   miss. If the link is expired, it returns a `status: 'expired'` resolution,
   which the controller translates to an HTTP 410 Gone response. Expired links
   are never served as valid redirects.

2. **In the background:** a scheduled job (`CleanupService`) runs hourly,
   finds up to 1,000 expired rows per run, deletes them from Postgres, and
   removes their Redis cache entries. Failures on individual items are logged
   and skipped; the job tolerates partial completion.

## Alternatives Considered

- **Return 404 for expired links:** simpler to implement (treat expired the
  same as not-found), but semantically incorrect. HTTP 410 is the standard
  signal that a resource existed and is gone permanently, which is the correct
  meaning here.
- **Delete expired rows at serve time (lazy cleanup):** avoids a background
  job, but adds a delete query to the 410 response path and can lead to
  inconsistent cleanup if the expired link is not accessed again.
- **Postgres TTL extension or partitioning for automatic deletion:** removes
  rows without application code, but requires a Postgres extension (pg_partman
  or similar) and couples the cleanup mechanism to the database configuration
  rather than the application.
- **Continuous cleanup loop:** runs more frequently than hourly but wastes
  resources if the expired-link rate is low; a cron expression is simpler to
  reason about and configure.

## Consequences

- Clients that bookmark an expired link receive a clear 410 Gone rather than
  an ambiguous 404, allowing them to handle the permanent-removal case
  distinctly.
- The hourly batch keeps Postgres table size bounded without requiring table
  partitioning or database-level TTL mechanisms.
- A link that expires between hourly cleanup runs will continue to exist in the
  database but will correctly return 410 at serve time, so the user experience
  is consistent even before cleanup runs.
- Per-item failure tolerance means a transient database error on one slug does
  not prevent cleanup of other expired links in the same batch.
- The cache invalidation step in the cleanup job prevents stale cache entries
  from outliving their database rows; without it a deleted link could still
  resolve from the Redis cache until its TTL expires naturally.
