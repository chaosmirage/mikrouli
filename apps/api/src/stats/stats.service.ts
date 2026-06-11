import { Injectable, Logger } from '@nestjs/common';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { parseBrowserId, parseOsId, BROWSER_NAMES, COUNTRY_NAMES } from './ua-parser';

const COUNT_RADIX = 10;
const TOP_LIMIT = 10;
const COUNTRY_UNKNOWN_ID = 0;
const CITY_UNKNOWN_ID = 0;

export interface AggregatedStats {
  totalClicks: number;
  clicksByDay: Array<{ date: string; clicks: number }>;
  topCountries: Array<{ name: string; clicks: number }>;
  topBrowsers: Array<{ name: string; clicks: number }>;
}

interface TotalRow {
  total: string;
}
interface DayRow {
  date: string;
  clicks: string;
}
interface CountryRow {
  country_id: string;
  clicks: string;
}
interface BrowserRow {
  browser_id: string;
  clicks: string;
}

const TOTAL_QUERY = `SELECT count() AS total FROM stats_buffer WHERE short_url = {slug:String}`;
const BY_DAY_QUERY = `SELECT toDate(timestamp) AS date, count() AS clicks FROM stats_buffer WHERE short_url = {slug:String} GROUP BY date ORDER BY date`;
const TOP_COUNTRIES_QUERY = `SELECT country_id, count() AS clicks FROM stats_buffer WHERE short_url = {slug:String} GROUP BY country_id ORDER BY clicks DESC LIMIT ${TOP_LIMIT}`;
const TOP_BROWSERS_QUERY = `SELECT browser_id, count() AS clicks FROM stats_buffer WHERE short_url = {slug:String} GROUP BY browser_id ORDER BY clicks DESC LIMIT ${TOP_LIMIT}`;

function buildStatRow(
  shortUrl: string,
  ip: string | undefined,
  ua: string | undefined,
): Record<string, unknown> {
  return {
    short_url: shortUrl,
    ip: ip ?? '',
    country_id: COUNTRY_UNKNOWN_ID,
    city_id: CITY_UNKNOWN_ID,
    os_id: parseOsId(ua),
    browser_id: parseBrowserId(ua),
  };
}

function toInt(value: string): number {
  return parseInt(value, COUNT_RADIX);
}

function mapDayRows(rows: DayRow[]): Array<{ date: string; clicks: number }> {
  return rows.map((r) => ({ date: r.date, clicks: toInt(r.clicks) }));
}

function mapCountryRows(rows: CountryRow[]): Array<{ name: string; clicks: number }> {
  return rows.map((r) => ({
    name: COUNTRY_NAMES[toInt(r.country_id)] ?? 'Unknown',
    clicks: toInt(r.clicks),
  }));
}

function mapBrowserRows(rows: BrowserRow[]): Array<{ name: string; clicks: number }> {
  return rows.map((r) => ({
    name: BROWSER_NAMES[toInt(r.browser_id)] ?? 'Unknown',
    clicks: toInt(r.clicks),
  }));
}

function assembleStats(
  totalResult: TotalRow[],
  byDayResult: DayRow[],
  countriesResult: CountryRow[],
  browsersResult: BrowserRow[],
): AggregatedStats {
  return {
    totalClicks: toInt(totalResult[0]?.total ?? '0'),
    clicksByDay: mapDayRows(byDayResult),
    topCountries: mapCountryRows(countriesResult),
    topBrowsers: mapBrowserRows(browsersResult),
  };
}

async function recordSafe(
  ch: ClickHouseService,
  shortUrl: string,
  ip: string | undefined,
  ua: string | undefined,
  logger: Logger,
): Promise<void> {
  try {
    await ch.insert('stats_buffer', [buildStatRow(shortUrl, ip, ua)]);
  } catch (err) {
    logger.error(`Failed to record stat for slug "${shortUrl}"`, String(err));
  }
}

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private readonly clickHouseService: ClickHouseService) {}

  async record(
    shortUrl: string,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<void> {
    await recordSafe(this.clickHouseService, shortUrl, ip, userAgent, this.logger);
  }

  async getStats(shortUrl: string): Promise<AggregatedStats> {
    const params = { slug: shortUrl };
    const totalP = this.clickHouseService.query<TotalRow>(TOTAL_QUERY, params);
    const byDayP = this.clickHouseService.query<DayRow>(BY_DAY_QUERY, params);
    const countriesP = this.clickHouseService.query<CountryRow>(TOP_COUNTRIES_QUERY, params);
    const browsersP = this.clickHouseService.query<BrowserRow>(TOP_BROWSERS_QUERY, params);
    const [total, byDay, countries, browsers] = await Promise.all([
      totalP,
      byDayP,
      countriesP,
      browsersP,
    ]);
    return assembleStats(total, byDay, countries, browsers);
  }
}
