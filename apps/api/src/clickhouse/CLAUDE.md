# clickhouse

## Purpose

Provides a NestJS-injectable ClickHouse client that creates the click-analytics
schema on startup and exposes typed query and insert helpers. Authentication
against ClickHouse is required at boot; the service refuses to start if the
password is absent.

## Key pieces

- `clickhouse.service.ts` -- `ClickHouseService`. Built with `CLICKHOUSE_HOST`,
  `CLICKHOUSE_PORT`, and `CLICKHOUSE_PASSWORD` (required; `getOrThrow` throws at
  boot if absent). On `onModuleInit` it runs the DDL list to create the stats
  tables and seeds the OS / browser / country / city dictionary tables if empty.
  Exposes two public methods:
  - `insert(table, values)` -- appends rows in JSONEachRow format.
  - `query<T>(sql, query_params?)` -- executes a SELECT with optional named
    parameters; callers must pass user-supplied values via `query_params` rather
    than string interpolation to avoid injection.
- `clickhouse.module.ts` -- registers `ClickHouseService` and exports it for
  `StatsModule`.

## How to extend safely

- Always pass variable input (slugs, IDs) via the `query_params` argument rather
  than embedding it in the SQL string. The ClickHouse client transmits params
  out-of-band as query parameters, which prevents injection.
- `CLICKHOUSE_PASSWORD` is required; omitting it from the environment causes the
  service to refuse to boot rather than silently connecting without credentials.
- Schema migrations belong in the `STATS_DDL` constant at the top of
  `clickhouse.service.ts`. The `IF NOT EXISTS` guard makes re-runs safe.
- Keep dictionary tables (os, browsers, countries, cities) seeded only when
  empty; the seed logic in `seedTableIfEmpty` checks the row count before
  inserting.
