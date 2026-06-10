# 0001 - Three-Store Persistence Split

**Status:** Accepted

## Context

The application has three distinct persistence needs with different access patterns
and consistency requirements:

- *Relational data* (links, users, API keys, outbox events) requires transactional
  writes, foreign-key integrity, and ordered queries.
- *Redirect resolution* is the hot path and must be as fast as possible; a database
  round-trip on every redirect would be the primary latency bottleneck.
- *Click analytics* are append-only, high-volume, and never need to be joined with
  relational data in the same query.

Using a single store for all three would require compromising on at least one
access pattern. A general-purpose relational database can handle all three roles,
but at the cost of either high latency on the redirect hot path or
disproportionate table growth in Postgres from raw click rows.

Evidence: `docker-compose.yml` declares three data services (`postgres`,
`redis-primary`, `redis-replica`, `clickhouse`); the API's data layer is split
across `apps/api/src/data-source.ts` (Postgres/TypeORM), `apps/api/src/redis/`,
and `apps/api/src/clickhouse/`.

## Decision

Use three stores, each matched to its access pattern:

- **PostgreSQL** is the relational source of truth for links, users, API keys,
  and the transactional outbox. All writes that require atomicity go here.
- **Redis** is a read-through cache for redirect resolution. The primary instance
  accepts writes; a read replica serves cache reads under load.
- **ClickHouse** stores click analytics as an append-only fact table, keeping raw
  click volume out of Postgres entirely.

## Alternatives Considered

- **Single Postgres store:** simpler operationally, but every redirect would hit
  Postgres and the `stats` table would accumulate millions of rows alongside
  relational data, degrading index performance over time.
- **Postgres + Redis, counting clicks in Postgres:** avoids a third store, but
  forces high-write click inserts into the same OLTP database, causing lock
  contention on aggregate queries.
- **Single key-value store for everything:** loses transactional guarantees
  needed for outbox writes and relational link management.

## Consequences

- Operational overhead increases: three different engines to configure, back up,
  and monitor.
- Each store can be scaled and tuned independently of the others.
- The redirect hot path can achieve sub-millisecond cache hits without touching
  Postgres or ClickHouse.
- ClickHouse's columnar storage makes time-series aggregation over click data
  efficient at scale.
