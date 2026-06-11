import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LinksService } from '../links/links.service';
import { LinkCacheService } from '../cache/link-cache.service';
import { RedisService } from '../redis/redis.service';
import { RedirectService } from './redirect.service';
import type { Link } from '../links/entities/link.entity';

const TEST_SLUG = 'abc123';

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

function makeLink(originalUrl: string): Link {
  return {
    shortUrl: TEST_SLUG,
    originalUrl,
    userId: 'u1',
    createdAt: new Date(),
    expiresAt: null,
    user: undefined as never,
  };
}

describe('RedirectService scheme guard', () => {
  let service: RedirectService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule(moduleMetadata).compile();
    service = module.get<RedirectService>(RedirectService);
  });

  it('returns active for a valid https URL stored in DB', async () => {
    mockRedisService.get.mockResolvedValue(null);
    mockLinksService.findBySlug.mockResolvedValue(makeLink('https://example.com/'));
    const result = await service.resolve(TEST_SLUG);
    expect(result.status).toBe('active');
    expect(result.originalUrl).toBe('https://example.com/');
  });

  it('returns active for a valid http URL served from cache', async () => {
    mockRedisService.get.mockResolvedValue('http://example.com/');
    const result = await service.resolve(TEST_SLUG);
    expect(result.status).toBe('active');
    expect(result.originalUrl).toBe('http://example.com/');
  });

  it('returns not-found when the stored URL has a non-http(s) scheme (DB path)', async () => {
    mockRedisService.get.mockResolvedValue(null);
    mockLinksService.findBySlug.mockResolvedValue(makeLink('javascript:alert(1)'));
    const result = await service.resolve(TEST_SLUG);
    expect(result.status).toBe('not-found');
  });

  it('returns not-found when the cached URL has a non-http(s) scheme', async () => {
    mockRedisService.get.mockResolvedValue('javascript:alert(1)');
    const result = await service.resolve(TEST_SLUG);
    expect(result.status).toBe('not-found');
  });

  it('returns not-found when the stored URL has a ftp scheme (DB path)', async () => {
    mockRedisService.get.mockResolvedValue(null);
    mockLinksService.findBySlug.mockResolvedValue(makeLink('ftp://evil.com/file'));
    const result = await service.resolve(TEST_SLUG);
    expect(result.status).toBe('not-found');
  });
});
