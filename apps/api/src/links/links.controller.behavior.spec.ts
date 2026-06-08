// Pins the observable behavior of LinksController: ttlSecondsUntil caps at 86400
// (null / far-future) and past expiry yields an undefined TTL (observed via warmCache
// -> redisService.set third arg); DELETE returns 204.
import { ModuleMetadata, HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';
import { LinkCacheService } from '../cache/link-cache.service';
import { RedisService } from '../redis/redis.service';
import { BearerOrApiKeyGuard } from '../api-keys/bearer-or-api-key.guard';
import type { Link } from './entities/link.entity';

const TEST_SLUG = 'abc123';
const TEST_URL = 'https://example.com/path';
const TEST_USER_ID = 'user-uuid';
const FAR_FUTURE_DATE = new Date('2099-01-01T00:00:00Z');
const PAST_DATE = new Date('2020-01-01T00:00:00Z');
const TTL_CAP_SECONDS = 86400;

const mockLinksService = {
  create: jest.fn(),
  listForUser: jest.fn(),
  delete: jest.fn(),
};
const mockRedisService = { set: jest.fn(), del: jest.fn(), get: jest.fn() };
const mockGuard = { canActivate: jest.fn().mockReturnValue(true) };

const moduleMetadata: ModuleMetadata = {
  controllers: [LinksController],
  providers: [
    LinkCacheService,
    { provide: LinksService, useValue: mockLinksService },
    { provide: RedisService, useValue: mockRedisService },
  ],
};

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    shortUrl: TEST_SLUG,
    originalUrl: TEST_URL,
    userId: TEST_USER_ID,
    createdAt: new Date(),
    expiresAt: FAR_FUTURE_DATE,
    user: undefined as never,
    ...overrides,
  };
}

function makeRequest(): { user: { id: string } } {
  return { user: { id: TEST_USER_ID } };
}

describe('LinksController', () => {
  let controller: LinksController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const builder = Test.createTestingModule(moduleMetadata);
    builder.overrideGuard(BearerOrApiKeyGuard).useValue(mockGuard);
    const module: TestingModule = await builder.compile();
    controller = module.get<LinksController>(LinksController);
  });

  it('pins TTL cap == 86400 when expiresAt is null', async () => {
    mockLinksService.create.mockResolvedValue(makeLink({ expiresAt: null }));
    await controller.create(makeRequest() as never, { url: TEST_URL });
    expect(mockRedisService.set).toHaveBeenCalledWith(
      `link:${TEST_SLUG}`,
      TEST_URL,
      TTL_CAP_SECONDS,
    );
  });

  it('pins TTL cap == 86400 when expiresAt is far in the future (capped)', async () => {
    mockLinksService.create.mockResolvedValue(makeLink({ expiresAt: FAR_FUTURE_DATE }));
    await controller.create(makeRequest() as never, { url: TEST_URL });
    expect(mockRedisService.set).toHaveBeenCalledWith(
      `link:${TEST_SLUG}`,
      TEST_URL,
      TTL_CAP_SECONDS,
    );
  });

  it('pins past expiry -> undefined TTL (no caching duration)', async () => {
    mockLinksService.create.mockResolvedValue(makeLink({ expiresAt: PAST_DATE }));
    await controller.create(makeRequest() as never, { url: TEST_URL });
    expect(mockRedisService.set).toHaveBeenCalledWith(`link:${TEST_SLUG}`, TEST_URL, undefined);
  });

  it('pins DELETE /urls/:slug -> 204 No Content', () => {
    const httpCode = Reflect.getMetadata(HTTP_CODE_METADATA, controller.remove);
    expect(httpCode).toBe(204);
    expect(httpCode).toBe(HttpStatus.NO_CONTENT);
  });
});
