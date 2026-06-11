# stats

## Purpose

Records per-click analytics into ClickHouse and queries aggregated stats
(total clicks, clicks by day, top countries, top browsers) for the dashboard.
All queries pass the user-supplied slug via named parameters to prevent
injection.

## Key pieces

- `stats.service.ts` -- `StatsService`. `record(shortUrl, ip, userAgent)` inserts
  one row into `stats_buffer` fire-and-forget (errors are logged, not surfaced to
  the caller). `getStats(slug)` runs four parameterized queries in parallel and
  assembles the `AggregatedStats` object.
- `stats.controller.ts` -- exposes `GET /api/stats/:slug` (owner-only, guarded by
  `JwtAuthGuard`). Delegates to `StatsService.getStats`.
- `ua-parser.ts` -- pure functions that parse a User-Agent string into integer
  browser-id and OS-id using the seeded dictionary tables. No external HTTP
  calls.

## How to extend safely

- All query SQL lives in module-level constants (`TOTAL_QUERY`, `BY_DAY_QUERY`,
  etc.) using the `{slug:String}` named-parameter syntax. Never build query
  strings by concatenating user input; pass values via the `query_params`
  argument of `ClickHouseService.query`.
- `stats_buffer` (a Buffer engine table) is the write target; `stats` is the
  underlying MergeTree. Reads query `stats_buffer` to include buffered rows that
  have not yet been flushed.
- `record` is intentionally fire-and-forget: a ClickHouse write failure must not
  fail the redirect response.
- When adding a new dimension (e.g. a new country source), extend the dictionary
  tables in `clickhouse.service.ts` STATS_DDL and update the seeding data there;
  do not add seeding logic directly in `stats.service.ts`.
