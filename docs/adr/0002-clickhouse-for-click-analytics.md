# 0002 - ClickHouse for Click Analytics with Buffer-Engine Ingestion

**Status:** Accepted

## Context

Click events are recorded on every successful redirect. The requirements are:

- Inserts must be extremely fast and must never block or slow the redirect
  response (see ADR 0004).
- Aggregation queries (total clicks, clicks by day, top browsers, top countries)
  scan all rows for a given slug and benefit from columnar storage.
- Data is append-only and never updated after insertion.
- Partitioning by time is natural because analytics queries are typically
  scoped to a time window.

A row-oriented OLTP database like Postgres can store click rows, but bulk
column scans for aggregation become progressively more expensive as the table
grows, and high-frequency single-row inserts create write amplification in
B-tree indexes.

Evidence: `apps/api/src/clickhouse/clickhouse.service.ts` defines the DDL:
a `stats` table using `ENGINE = MergeTree() PARTITION BY toYYYYMM(timestamp)
ORDER BY (short_url, timestamp)` and a `stats_buffer` ingestion table using
`ENGINE = Buffer(currentDatabase(), stats, 16, 10, 100, ...)`.

## Decision

Use ClickHouse as the analytics store, with two tables:

- **`stats`** is the durable fact table. It uses `MergeTree` partitioned by
  year-month and ordered by `(short_url, timestamp)`, which aligns with the
  primary query pattern (all clicks for a slug in a time range).
- **`stats_buffer`** is a `Buffer`-engine ingestion table that sits in front of
  `stats`. All writes go to `stats_buffer`; ClickHouse flushes batches to
  `stats` asynchronously based on row count, byte size, and time thresholds.
  Read queries also target `stats_buffer` so they include unflushed rows.

All analytics queries in `apps/api/src/stats/stats.service.ts` query
`stats_buffer` rather than `stats` directly, ensuring reads include data that
has not yet been flushed to the base table.

## Alternatives Considered

- **Count clicks in Postgres:** avoids a separate store but creates OLTP/OLAP
  contention. Aggregate scans over large click tables degrade alongside
  transactional link operations.
- **Time-series database (e.g., InfluxDB, TimescaleDB):** well-suited to the
  time dimension but adds a fourth distinct store family with its own query
  language and operational surface.
- **Direct writes to the `stats` MergeTree table without a Buffer layer:** safe
  but ClickHouse's MergeTree engine performs best with batch inserts. Individual
  row inserts cause frequent small part merges, increasing background I/O.

## Consequences

- The Buffer engine decouples redirect-time insert latency from ClickHouse's
  merge I/O, keeping the analytics write path non-blocking.
- Data visible in `stats_buffer` but not yet flushed to `stats` could be lost
  in a ClickHouse crash before the flush threshold is reached; this is an
  accepted trade-off given the fire-and-forget nature of click recording.
- `PARTITION BY toYYYYMM` keeps per-partition sizes bounded and allows
  efficient partition pruning on time-range queries.
- Country and city resolution are currently not implemented; `country_id` and
  `city_id` are always stored as `0` (Unknown), as seen in `stats.service.ts`.
