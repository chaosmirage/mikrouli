// Pins the observable behavior of RedirectService: ttlSecondsUntil caps at 86400
// (null / far-future), observed via backfill -> redisService.set third arg; an expired
// link is never cached (no set call).
import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LinksService } from '../links/links.service';
import { LinkCacheService } from '../cache/link-cache.service';
import { RedisService } from '../redis/redis.service';
import { RedirectService } from './redirect.service';
import type { Link } from '../links/entities/link.entity';

const TEST_SLUG = 'abc123';
const TEST_URL = 'https://example.com/destination';
const PAST_DATE = new Date('2020-01-01T00:00:00Z');
const FAR_FUTURE_DATE = new Date('2099-01-01T00:00:00Z');
const TTL_CAP_SECONDS = 86400;

const mockLinksService = { findBySlug: jest.fn() };
const mockRedisService = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

const moduleMetadata: ModuleMetadata = {
  providers: [
    RedirectService,
    LinkCacheService,
    { provide: LinksService, useValue: mockLinksService },
    { provide: RedisService, useValue: mockRedisService },
  ],
};

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    shortUrl: TEST_SLUG,
    originalUrl: TEST_URL,
    userId: 'u1',
    createdAt: new Date(),
    expiresAt: FAR_FUTURE_DATE,
    user: undefined as never,
    ...overrides,
  };
}

describe('RedirectService', () => {
  let service: RedirectService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule(moduleMetadata).compile();
    service = module.get<RedirectService>(RedirectService);
  });

  it('pins backfill TTL cap == 86400 when expiresAt is null', async () => {
    mockRedisService.get.mockResolvedValue(null);
    mockLinksService.findBySlug.mockResolvedValue(makeLink({ expiresAt: null }));
    await service.resolve(TEST_SLUG);
    expect(mockRedisService.set).toHaveBeenCalledWith(
      `link:${TEST_SLUG}`,
      TEST_URL,
      TTL_CAP_SECONDS,
    );
  });

  it('pins backfill TTL cap == 86400 when expiresAt is far in the future (capped)', async () => {
    mockRedisService.get.mockResolvedValue(null);
    mockLinksService.findBySlug.mockResolvedValue(makeLink({ expiresAt: FAR_FUTURE_DATE }));
    await service.resolve(TEST_SLUG);
    expect(mockRedisService.set).toHaveBeenCalledWith(
      `link:${TEST_SLUG}`,
      TEST_URL,
      TTL_CAP_SECONDS,
    );
  });

  it('pins past-expiry link is never cached (no set) -- the no-caching observable', async () => {
    mockRedisService.get.mockResolvedValue(null);
    mockLinksService.findBySlug.mockResolvedValue(makeLink({ expiresAt: PAST_DATE }));
    const result = await service.resolve(TEST_SLUG);
    expect(result.status).toBe('expired');
    expect(mockRedisService.set).not.toHaveBeenCalled();
  });
});
