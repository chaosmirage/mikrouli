# 0003 - Redis Cache-Aside on the Redirect Hot Path

**Status:** Accepted

## Context

The redirect endpoint (`GET /:slug`) is the highest-traffic path in the
application. Its only data need is resolving a six-character slug to a
destination URL. Without caching, every redirect incurs a Postgres query, which
adds round-trip latency and increases database load proportionally with traffic.

The acceptable latency for a redirect is in the low-millisecond range; an
in-memory cache can satisfy reads at that level. The data being cached (slug ->
URL) is stable: it changes only when a link is deleted or expires.

Evidence:
- `apps/api/src/redirect/redirect.service.ts` implements the cache-aside pattern:
  `resolve()` calls `linkCache.get(slug)`; on a miss it calls
  `resolveFromDatabase()`, which sets the cache entry before returning.
- `apps/api/src/cache/link-cache.service.ts` wraps the Redis client with a
  `link:` key prefix and a TTL derived from the link's `expiresAt` field,
  capped at 24 hours.
- `docker-compose.yml` declares `redis-primary` and `redis-replica`; the API
  connects to `redis-primary` for writes and can be configured to read from the
  replica.

## Decision

Use Redis as a cache-aside store for slug-to-URL resolution on the redirect path:

1. On a redirect request, look up the slug in Redis.
2. On a cache hit, return the cached URL immediately without touching Postgres.
3. On a cache miss, query Postgres, write the result to Redis with a TTL aligned
   to the link's expiry (capped at 86,400 seconds), then return the URL.

A primary Redis instance handles writes; a read replica is provisioned in
`docker-compose.yml` to distribute read load. Cache entries are invalidated
explicitly when a link is deleted or when the hourly cleanup removes an expired
link (see ADR 0010).

## Alternatives Considered

- **No cache, direct Postgres on every redirect:** simplest to operate, but
  latency is bounded by Postgres round-trip time and load scales linearly with
  traffic.
- **In-process (in-memory) cache:** zero network overhead, but does not survive
  process restarts and cannot be shared across multiple API replicas.
- **Write-through cache (populate on link creation):** keeps the cache warm
  from the start, but requires the cache to be updated on every link write,
  coupling the write path to cache availability.

## Consequences

- Cache hits bypass Postgres entirely, giving sub-millisecond redirect resolution
  under normal load.
- A Redis failure degrades the service gracefully: on a cache miss the code falls
  through to Postgres, so redirects still work (at higher latency) without Redis.
- TTL-based expiry means a cached entry for a link deleted between cleanup cycles
  could still resolve briefly; explicit `del` calls in the cleanup path minimize
  this window.
- Two Redis instances (primary + replica) add operational overhead relative to a
  single node.
