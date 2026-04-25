import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LinksService } from '../links/links.service';
import { RedisService } from '../redis/redis.service';
import { RedirectService } from './redirect.service';
import type { Link } from '../links/entities/link.entity';

const TEST_SLUG = 'abc123';
const TEST_URL = 'https://example.com/destination';
const PAST_DATE = new Date('2020-01-01T00:00:00Z');
const FUTURE_DATE = new Date('2099-01-01T00:00:00Z');

const mockLinksService = { findBySlug: jest.fn() };
const mockRedisService = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

const moduleMetadata: ModuleMetadata = {
  providers: [
    RedirectService,
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
    expiresAt: FUTURE_DATE,
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

  it('returns active resolution from cache without DB call', async () => {
    mockRedisService.get.mockResolvedValue(TEST_URL);
    const result = await service.resolve(TEST_SLUG);
    expect(result).toEqual({ status: 'active', originalUrl: TEST_URL });
    expect(mockLinksService.findBySlug).not.toHaveBeenCalled();
  });

  it('falls back to DB on cache miss', async () => {
    mockRedisService.get.mockResolvedValue(null);
    mockLinksService.findBySlug.mockResolvedValue(makeLink());
    const result = await service.resolve(TEST_SLUG);
    expect(result.status).toBe('active');
    expect(result.originalUrl).toBe(TEST_URL);
    expect(mockLinksService.findBySlug).toHaveBeenCalledWith(TEST_SLUG);
  });

  it('backfills Redis after cache-miss DB hit', async () => {
    mockRedisService.get.mockResolvedValue(null);
    mockLinksService.findBySlug.mockResolvedValue(makeLink());
    await service.resolve(TEST_SLUG);
    expect(mockRedisService.set).toHaveBeenCalledWith(
      `link:${TEST_SLUG}`,
      TEST_URL,
      expect.any(Number),
    );
  });

  it('returns not-found when slug missing in DB', async () => {
    mockRedisService.get.mockResolvedValue(null);
    mockLinksService.findBySlug.mockResolvedValue(null);
    const result = await service.resolve(TEST_SLUG);
    expect(result).toEqual({ status: 'not-found' });
  });

  it('returns expired when DB record past expiresAt', async () => {
    mockRedisService.get.mockResolvedValue(null);
    mockLinksService.findBySlug.mockResolvedValue(makeLink({ expiresAt: PAST_DATE }));
    const result = await service.resolve(TEST_SLUG);
    expect(result.status).toBe('expired');
    expect(mockRedisService.set).not.toHaveBeenCalled();
  });
});
