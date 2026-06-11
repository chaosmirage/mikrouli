import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { StatsService } from './stats.service';

const TEST_SLUG = 'abc123';
const TEST_IP = '1.2.3.4';
const TEST_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120';
// A slug containing SQL injection characters; must arrive as a bound param, not spliced into SQL.
const CRAFTED_SLUG = "it's'; DROP TABLE stats_buffer;--";

const mockClickHouseService = { insert: jest.fn(), query: jest.fn() };

const moduleMetadata: ModuleMetadata = {
  providers: [StatsService, { provide: ClickHouseService, useValue: mockClickHouseService }],
};

function seedQueryMocks(): void {
  mockClickHouseService.query.mockResolvedValueOnce([{ total: '5' }]);
  mockClickHouseService.query.mockResolvedValueOnce([{ date: '2024-01-01', clicks: '3' }]);
  mockClickHouseService.query.mockResolvedValueOnce([{ country_id: '0', clicks: '5' }]);
  mockClickHouseService.query.mockResolvedValueOnce([{ browser_id: '1', clicks: '5' }]);
}

function seedEmptyQueryMocks(): void {
  mockClickHouseService.query.mockResolvedValueOnce([]);
  mockClickHouseService.query.mockResolvedValueOnce([]);
  mockClickHouseService.query.mockResolvedValueOnce([]);
  mockClickHouseService.query.mockResolvedValueOnce([]);
}

describe('StatsService', () => {
  let service: StatsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule(moduleMetadata).compile();
    service = module.get<StatsService>(StatsService);
  });

  it('record inserts a row into stats_buffer with correct fields', async () => {
    mockClickHouseService.insert.mockResolvedValue(undefined);
    await service.record(TEST_SLUG, TEST_IP, TEST_UA);
    const expectedRows = [expect.objectContaining({ short_url: TEST_SLUG, ip: TEST_IP })];
    expect(mockClickHouseService.insert).toHaveBeenCalledWith('stats_buffer', expectedRows);
  });

  it('record resolves without throwing when ClickHouse is unavailable', async () => {
    mockClickHouseService.insert.mockRejectedValue(new Error('CH down'));
    await expect(service.record(TEST_SLUG, TEST_IP, TEST_UA)).resolves.toBeUndefined();
  });

  it('getStats returns aggregated data with correct shape', async () => {
    seedQueryMocks();
    const result = await service.getStats(TEST_SLUG);
    expect(result.totalClicks).toBe(5);
    expect(result.clicksByDay).toEqual([{ date: '2024-01-01', clicks: 3 }]);
    expect(result.topCountries[0]).toEqual({ name: 'Unknown', clicks: 5 });
    expect(result.topBrowsers[0]).toEqual({ name: 'Chrome', clicks: 5 });
  });

  it('getStats returns zeros and empty arrays when no data exists', async () => {
    seedEmptyQueryMocks();
    const result = await service.getStats(TEST_SLUG);
    expect(result.totalClicks).toBe(0);
    expect(result.clicksByDay).toHaveLength(0);
    expect(result.topCountries).toHaveLength(0);
    expect(result.topBrowsers).toHaveLength(0);
  });

  it('getStats passes the slug as a bound query_params value, not spliced into the SQL string', async () => {
    // Each of the four analytics queries must carry the slug in query_params so the
    // ClickHouse client handles quoting — never concatenated into the SQL text.
    seedQueryMocks();
    await service.getStats(TEST_SLUG);

    const calls = mockClickHouseService.query.mock.calls as Array<[string, Record<string, unknown>]>;
    expect(calls).toHaveLength(4);
    for (const [sql, params] of calls) {
      // The SQL must contain the named placeholder, not the literal slug value.
      expect(sql).toContain('{slug:String}');
      expect(sql).not.toContain(TEST_SLUG);
      // The slug must arrive via query_params.
      expect(params).toEqual(expect.objectContaining({ slug: TEST_SLUG }));
    }
  });

  it('getStats passes a crafted slug with quotes as a bound param without altering the SQL', async () => {
    // A slug containing quote characters must be forwarded as-is in query_params;
    // the SQL template must remain unchanged regardless of what the slug contains.
    seedQueryMocks();
    await service.getStats(CRAFTED_SLUG);

    const calls = mockClickHouseService.query.mock.calls as Array<[string, Record<string, unknown>]>;
    expect(calls).toHaveLength(4);
    for (const [sql, params] of calls) {
      expect(sql).toContain('{slug:String}');
      expect(sql).not.toContain(CRAFTED_SLUG);
      expect(params).toEqual(expect.objectContaining({ slug: CRAFTED_SLUG }));
    }
  });
});
