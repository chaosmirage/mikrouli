import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

const mockRedisInstance = {
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  on: jest.fn(),
};
const mockRedisConstructor = jest.fn().mockReturnValue(mockRedisInstance);
jest.mock('ioredis', () => ({ default: mockRedisConstructor }));

import { RedisService } from './redis.service';

describe('RedisService — authenticated client construction', () => {
  beforeEach(() => {
    mockRedisConstructor.mockClear();
    mockRedisInstance.connect.mockClear();
  });

  it('passes the password from REDIS_PASSWORD to the ioredis constructor', async () => {
    const configValues: Record<string, string | number> = {
      REDIS_HOST: 'redis-primary',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: 'redis-secret',
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
      providers: [RedisService, { provide: ConfigService, useValue: configService }],
    }).compile();

    expect(mockRedisConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        password: 'redis-secret',
      }),
    );
  });

  it('throws at startup when REDIS_PASSWORD is absent', async () => {
    const configService = {
      get: (key: string, fallback?: unknown) => {
        const vals: Record<string, unknown> = { REDIS_HOST: 'redis-primary', REDIS_PORT: 6379 };
        return vals[key] ?? fallback;
      },
      getOrThrow: (key: string) => {
        throw new Error(`Missing config: ${key}`);
      },
    } as unknown as ConfigService;

    await expect(
      Test.createTestingModule({
        providers: [RedisService, { provide: ConfigService, useValue: configService }],
      }).compile(),
    ).rejects.toThrow();
  });

  it('keeps the safe* degrade-to-null wrappers intact: get returns null on Redis error', async () => {
    const configValues: Record<string, string | number> = {
      REDIS_HOST: 'redis-primary',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: 'pw',
    };
    const configService = {
      get: (key: string, fallback?: unknown) => configValues[key] ?? fallback,
      getOrThrow: (key: string) => {
        const v = configValues[key];
        if (v === undefined) throw new Error(`Missing config: ${key}`);
        return v;
      },
    } as unknown as ConfigService;

    const module = await Test.createTestingModule({
      providers: [RedisService, { provide: ConfigService, useValue: configService }],
    }).compile();

    const service = module.get(RedisService);
    // Inject a failing get via the instance mock
    mockRedisInstance.get.mockRejectedValueOnce(new Error('ECONNRESET'));

    const result = await service.get('some-key');
    expect(result).toBeNull();
  });

  it('getOrThrow propagates Redis errors (fail-closed for revocation store)', async () => {
    const configValues: Record<string, string | number> = {
      REDIS_HOST: 'redis-primary',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: 'pw',
    };
    const configService = {
      get: (key: string, fallback?: unknown) => configValues[key] ?? fallback,
      getOrThrow: (key: string) => {
        const v = configValues[key];
        if (v === undefined) throw new Error(`Missing config: ${key}`);
        return v;
      },
    } as unknown as ConfigService;

    const module = await Test.createTestingModule({
      providers: [RedisService, { provide: ConfigService, useValue: configService }],
    }).compile();

    const service = module.get(RedisService);
    mockRedisInstance.get.mockRejectedValueOnce(new Error('ECONNRESET'));

    // Unlike the safe* wrappers, getOrThrow must propagate the error.
    await expect(service.getOrThrow('revocation-key')).rejects.toThrow('ECONNRESET');
  });

  it('delOrThrow propagates Redis errors (fail-closed for revocation store)', async () => {
    const configValues: Record<string, string | number> = {
      REDIS_HOST: 'redis-primary',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: 'pw',
    };
    const configService = {
      get: (key: string, fallback?: unknown) => configValues[key] ?? fallback,
      getOrThrow: (key: string) => {
        const v = configValues[key];
        if (v === undefined) throw new Error(`Missing config: ${key}`);
        return v;
      },
    } as unknown as ConfigService;

    const module = await Test.createTestingModule({
      providers: [RedisService, { provide: ConfigService, useValue: configService }],
    }).compile();

    const service = module.get(RedisService);
    mockRedisInstance.del.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(service.delOrThrow('revocation-key')).rejects.toThrow('Redis unavailable');
  });
});
