import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

const mockRedisInstance = {
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  getdel: jest.fn(),
  on: jest.fn(),
};
const mockRedisConstructor = jest.fn().mockReturnValue(mockRedisInstance);
jest.mock('ioredis', () => ({ default: mockRedisConstructor }));

import { RedisService } from './redis.service';

// Shared config factory for the tests that need a fully constructed service
function makeConfigService(overrides: Record<string, string | number> = {}): ConfigService {
  const configValues: Record<string, string | number> = {
    REDIS_HOST: 'redis-primary',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: 'pw',
    ...overrides,
  };
  return {
    get: (key: string, fallback?: unknown) => configValues[key] ?? fallback,
    getOrThrow: (key: string) => {
      const v = configValues[key];
      if (v === undefined) throw new Error(`Missing config: ${key}`);
      return v;
    },
  } as unknown as ConfigService;
}

async function buildService(cfg: ConfigService): Promise<RedisService> {
  const module = await Test.createTestingModule({
    providers: [RedisService, { provide: ConfigService, useValue: cfg }],
  }).compile();
  return module.get(RedisService);
}

describe('RedisService — authenticated client construction', () => {
  beforeEach(() => {
    mockRedisConstructor.mockClear();
    mockRedisInstance.connect.mockClear();
  });

  it('passes the password from REDIS_PASSWORD to the ioredis constructor', async () => {
    await Test.createTestingModule({
      providers: [RedisService, { provide: ConfigService, useValue: makeConfigService({ REDIS_PASSWORD: 'redis-secret' }) }],
    }).compile();

    expect(mockRedisConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'redis-secret' }),
    );
  });

  it('throws at startup when REDIS_PASSWORD is absent', async () => {
    const configService = {
      get: (key: string, fallback?: unknown) => {
        const vals: Record<string, unknown> = { REDIS_HOST: 'redis-primary', REDIS_PORT: 6379 };
        return vals[key] ?? fallback;
      },
      getOrThrow: (_key: string) => { throw new Error('Missing config'); },
    } as unknown as ConfigService;

    await expect(
      Test.createTestingModule({
        providers: [RedisService, { provide: ConfigService, useValue: configService }],
      }).compile(),
    ).rejects.toThrow();
  });

  it('keeps the safe* degrade-to-null wrappers intact: get returns null on Redis error', async () => {
    const service = await buildService(makeConfigService());
    mockRedisInstance.get.mockRejectedValueOnce(new Error('ECONNRESET'));
    const result = await service.get('some-key');
    expect(result).toBeNull();
  });

  it('getOrThrow propagates Redis errors (fail-closed for revocation store)', async () => {
    const service = await buildService(makeConfigService());
    mockRedisInstance.get.mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(service.getOrThrow('revocation-key')).rejects.toThrow('ECONNRESET');
  });

  it('delOrThrow propagates Redis errors (fail-closed for revocation store)', async () => {
    const service = await buildService(makeConfigService());
    mockRedisInstance.del.mockRejectedValueOnce(new Error('Redis unavailable'));
    await expect(service.delOrThrow('revocation-key')).rejects.toThrow('Redis unavailable');
  });

  // Atomic GETDEL for OAuth state (replay prevention)

  it('getDelOrThrow atomically returns the stored value and deletes the key', async () => {
    const service = await buildService(makeConfigService());
    mockRedisInstance.getdel.mockResolvedValueOnce('1');
    const result = await service.getDelOrThrow('auth:oauth:state:abc123');
    expect(result).toBe('1');
    expect(mockRedisInstance.getdel).toHaveBeenCalledWith('auth:oauth:state:abc123');
  });

  it('getDelOrThrow returns null when the key is absent (already consumed or expired)', async () => {
    const service = await buildService(makeConfigService());
    mockRedisInstance.getdel.mockResolvedValueOnce(null);
    const result = await service.getDelOrThrow('auth:oauth:state:missing');
    expect(result).toBeNull();
  });

  it('getDelOrThrow propagates Redis errors (fail-closed: no unverified continuation)', async () => {
    const service = await buildService(makeConfigService());
    mockRedisInstance.getdel.mockRejectedValueOnce(new Error('Redis down'));
    await expect(service.getDelOrThrow('auth:oauth:state:broken')).rejects.toThrow('Redis down');
  });
});
