// Pins the observable behavior of CleanupService: the deleted Redis key value is
// exactly `link:<slug>` for a whitespace-free char(6) slug, and the DB delete runs
// before the Redis del.
import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { CleanupService } from './cleanup.service';
import { LinkCacheService } from '../cache/link-cache.service';
import { RedisService } from '../redis/redis.service';
import { Link } from '../links/entities/link.entity';

const TEST_SLUG = 'aaaaaa';

const mockManager = { find: jest.fn(), delete: jest.fn() };
const mockDataSource = { manager: mockManager };
const mockRedis = { del: jest.fn(), get: jest.fn(), set: jest.fn() };

const moduleMetadata: ModuleMetadata = {
  providers: [
    CleanupService,
    LinkCacheService,
    { provide: DataSource, useValue: mockDataSource },
    { provide: RedisService, useValue: mockRedis },
  ],
};

function makeExpiredLink(slug = TEST_SLUG): Link {
  const past = new Date(Date.now() - 60_000);
  return {
    shortUrl: slug,
    originalUrl: 'https://example.com',
    userId: 'u',
    createdAt: past,
    expiresAt: past,
    user: undefined as never,
  };
}

describe('CleanupService', () => {
  let service: CleanupService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule(moduleMetadata).compile();
    service = module.get<CleanupService>(CleanupService);
  });

  it('pins deleted Redis key value == `link:<slug>` exactly (trim is a no-op on char(6) slug)', async () => {
    mockManager.find.mockResolvedValue([makeExpiredLink(TEST_SLUG)]);
    mockManager.delete.mockResolvedValue({ affected: 1 });
    await service.handleCleanup();
    // Exact byte-for-byte key value; no surrounding whitespace, trim has no effect today.
    const key = mockRedis.del.mock.calls[0][0] as string;
    expect(key).toBe(`link:${TEST_SLUG}`);
    expect(key).toBe('link:aaaaaa');
    expect(key).toBe(key.trim());
  });

  it('pins DB delete happens BEFORE Redis del (current ordering)', async () => {
    mockManager.find.mockResolvedValue([makeExpiredLink(TEST_SLUG)]);
    mockManager.delete.mockResolvedValue({ affected: 1 });
    await service.handleCleanup();
    const dbOrder = mockManager.delete.mock.invocationCallOrder[0];
    const redisOrder = mockRedis.del.mock.invocationCallOrder[0];
    expect(dbOrder).toBeLessThan(redisOrder);
  });
});
