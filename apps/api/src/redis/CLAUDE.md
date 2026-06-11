# redis

## Purpose

Wraps the ioredis client into a NestJS injectable service with two distinct
access semantics: a degrade-to-null cache path for non-critical operations, and
a fail-closed path for security-critical operations such as refresh-token
revocation.

## Key pieces

- `redis.service.ts` -- `RedisService`. Connects to Redis on module init using
  `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD` (required; throws at boot if
  absent). Exposes two surface pairs:
  - `get` / `set` / `del` -- swallow errors and return null; suitable for the
    redirect hot-path cache where a Redis outage should not break the user
    experience.
  - `getOrThrow` / `setOrThrow` / `delOrThrow` -- propagate errors to the
    caller; required for the refresh-token revocation allowlist because a
    silently-degraded revocation check would wave revoked tokens through.
- `redis.module.ts` -- registers `RedisService` and exports it for other
  modules.

## How to extend safely

- Never use the degrade-to-null methods (`get` / `set` / `del`) for any
  operation where a Redis failure must be treated as a deny (authentication
  gates, rate-limit counters, revocation checks). Use `*OrThrow` variants there
  and let the caller decide the error response.
- `REDIS_PASSWORD` is required; `configService.getOrThrow` is used intentionally
  so the process refuses to boot if the secret is missing rather than connecting
  to an unauthenticated instance.
- TTL parameters are in seconds; omitting the TTL argument stores the key
  without expiry -- always pass a TTL for ephemeral data such as cache entries
  and revocation records.
