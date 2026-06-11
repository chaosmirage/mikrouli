import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

// Stub createClient so no real TCP connection is attempted.
const mockCreateClient = jest.fn().mockReturnValue({
  close: jest.fn(),
  command: jest.fn(),
  query: jest.fn().mockResolvedValue({ json: jest.fn().mockResolvedValue([{ total: '1' }]) }),
  insert: jest.fn(),
});
jest.mock('@clickhouse/client', () => ({ createClient: mockCreateClient }));

import { ClickHouseService } from './clickhouse.service';

describe('ClickHouseService — authenticated client construction', () => {
  beforeEach(() => {
    mockCreateClient.mockClear();
  });

  it('builds the client with username "default" and the password from CLICKHOUSE_PASSWORD', async () => {
    const configValues: Record<string, string | number> = {
      CLICKHOUSE_HOST: 'clickhouse',
      CLICKHOUSE_PORT: 8123,
      CLICKHOUSE_PASSWORD: 'secret-pass',
    };
    const configService = {
      get: (key: string, fallback?: unknown) => configValues[key] ?? fallback,
      getOrThrow: (key: string) => {
        const v = configValues[key];
        if (v === undefined) throw new Error(`Missing config: ${key}`);
        return v;
      },
    } as unknown as ConfigService;

    await Test.createTestingModule({
      providers: [ClickHouseService, { provide: ConfigService, useValue: configService }],
    }).compile();

    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'default',
        password: 'secret-pass',
      }),
    );
  });

  it('throws at startup when CLICKHOUSE_PASSWORD is absent', async () => {
    const configService = {
      get: (key: string, fallback?: unknown) => {
        const vals: Record<string, unknown> = { CLICKHOUSE_HOST: 'ch', CLICKHOUSE_PORT: 8123 };
        return vals[key] ?? fallback;
      },
      getOrThrow: (key: string) => {
        throw new Error(`Missing config: ${key}`);
      },
    } as unknown as ConfigService;

    await expect(
      Test.createTestingModule({
        providers: [ClickHouseService, { provide: ConfigService, useValue: configService }],
      }).compile(),
    ).rejects.toThrow();
  });
});
