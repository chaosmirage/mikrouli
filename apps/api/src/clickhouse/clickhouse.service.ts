import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, ClickHouseClient } from '@clickhouse/client';

const DEFAULT_CH_PORT = 8123;
const REQUEST_TIMEOUT_MS = 30_000;
const COUNT_RADIX = 10;

const STATS_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS countries (id UInt16, name String) ENGINE = MergeTree() ORDER BY id`,
  `CREATE TABLE IF NOT EXISTS cities (id UInt16, name String) ENGINE = MergeTree() ORDER BY id`,
  `CREATE TABLE IF NOT EXISTS os (id UInt16, name String) ENGINE = MergeTree() ORDER BY id`,
  `CREATE TABLE IF NOT EXISTS browsers (id UInt16, name String) ENGINE = MergeTree() ORDER BY id`,
  `CREATE TABLE IF NOT EXISTS stats (
     short_url  String,
     timestamp  DateTime DEFAULT now(),
     ip         String,
     country_id UInt16 DEFAULT 0,
     city_id    UInt16 DEFAULT 0,
     os_id      UInt16 DEFAULT 0,
     browser_id UInt16 DEFAULT 0
   ) ENGINE = MergeTree() PARTITION BY toYYYYMM(timestamp) ORDER BY (short_url, timestamp)`,
  `CREATE TABLE IF NOT EXISTS stats_buffer AS stats
     ENGINE = Buffer(currentDatabase(), stats, 16, 10, 100, 10000, 1000000, 10000000, 100000000)`,
];

const OS_SEED = [
  { id: 0, name: 'Other' },
  { id: 1, name: 'Windows' },
  { id: 2, name: 'macOS' },
  { id: 3, name: 'Linux' },
  { id: 4, name: 'iOS' },
  { id: 5, name: 'Android' },
];

const BROWSER_SEED = [
  { id: 0, name: 'Other' },
  { id: 1, name: 'Chrome' },
  { id: 2, name: 'Firefox' },
  { id: 3, name: 'Safari' },
  { id: 4, name: 'Edge' },
  { id: 5, name: 'Opera' },
];

const COUNTRY_SEED = [{ id: 0, name: 'Unknown' }];
const CITY_SEED = [{ id: 0, name: 'Unknown' }];

const DICTIONARY_TABLES = [
  { table: 'os', rows: OS_SEED },
  { table: 'browsers', rows: BROWSER_SEED },
  { table: 'countries', rows: COUNTRY_SEED },
  { table: 'cities', rows: CITY_SEED },
];

function buildClient(configService: ConfigService): ClickHouseClient {
  const host = configService.get<string>('CLICKHOUSE_HOST', 'localhost');
  const port = configService.get<number>('CLICKHOUSE_PORT', DEFAULT_CH_PORT);
  return createClient({ url: `http://${host}:${port}`, database: 'default', request_timeout: REQUEST_TIMEOUT_MS });
}

async function runDdlList(client: ClickHouseClient, ddls: readonly string[]): Promise<void> {
  for (const ddl of ddls) {
    await client.command({ query: ddl });
  }
}

async function fetchRowCount(client: ClickHouseClient, table: string): Promise<number> {
  const result = await client.query({ query: `SELECT count() AS total FROM ${table}`, format: 'JSONEachRow' });
  const rows = await result.json<{ total: string }>();
  return parseInt(rows[0]?.total ?? '0', COUNT_RADIX);
}

async function seedTableIfEmpty(client: ClickHouseClient, table: string, rows: Record<string, unknown>[], logger: Logger): Promise<void> {
  const count = await fetchRowCount(client, table);
  if (count > 0) return;
  await client.insert({ table, values: rows, format: 'JSONEachRow' });
  logger.log(`Seeded dictionary table: ${table}`);
}

async function seedAllDictionaries(client: ClickHouseClient, logger: Logger): Promise<void> {
  for (const entry of DICTIONARY_TABLES) {
    await seedTableIfEmpty(client, entry.table, entry.rows, logger);
  }
}

async function initSchemaAndSeed(client: ClickHouseClient, logger: Logger): Promise<void> {
  try {
    await runDdlList(client, STATS_DDL);
    await seedAllDictionaries(client, logger);
    logger.log('ClickHouse schema ready');
  } catch (err) {
    logger.error('ClickHouse init failed — running in degraded mode', String(err));
  }
}

@Injectable()
export class ClickHouseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClickHouseService.name);
  private readonly client: ClickHouseClient;

  constructor(private readonly configService: ConfigService) {
    this.client = buildClient(configService);
  }

  async onModuleInit(): Promise<void> {
    await initSchemaAndSeed(this.client, this.logger);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  async insert(table: string, values: Record<string, unknown>[]): Promise<void> {
    await this.client.insert({ table, values, format: 'JSONEachRow' });
  }

  async query<T>(sql: string): Promise<T[]> {
    const result = await this.client.query({ query: sql, format: 'JSONEachRow' });
    return result.json<T>();
  }
}
