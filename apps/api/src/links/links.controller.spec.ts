import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';
import { LinkCacheService } from '../cache/link-cache.service';
import { RedisService } from '../redis/redis.service';
import { BearerOrApiKeyGuard } from '../api-keys/bearer-or-api-key.guard';
import { GuestOrAuthenticatedGuard } from '../api-keys/guest-or-authenticated.guard';
import type { Link } from './entities/link.entity';

const TEST_SLUG = 'abc123';
const TEST_URL = 'https://example.com/path';
const TEST_USER_ID = 'user-uuid';
const GUEST_USER_ID = 'guest-uuid';
const FUTURE_DATE = new Date('2099-01-01T00:00:00Z');

const mockLinksService = {
  create: jest.fn(),
  createGuest: jest.fn(),
  listForUser: jest.fn(),
  delete: jest.fn(),
  updateDestination: jest.fn(),
};
const mockRedisService = { set: jest.fn(), del: jest.fn(), get: jest.fn() };
const mockBearerGuard = { canActivate: jest.fn().mockReturnValue(true) };
const mockGuestGuard = { canActivate: jest.fn().mockReturnValue(true) };

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
    expiresAt: FUTURE_DATE,
    user: undefined as never,
    ...overrides,
  };
}

function makeRegisteredRequest(): { user: { id: string; isGuest: boolean } } {
  return { user: { id: TEST_USER_ID, isGuest: false } };
}

function makeGuestRequest(): { user: { id: string; isGuest: boolean } } {
  return { user: { id: GUEST_USER_ID, isGuest: true } };
}

describe('LinksController', () => {
  let controller: LinksController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const builder = Test.createTestingModule(moduleMetadata);
    builder.overrideGuard(BearerOrApiKeyGuard).useValue(mockBearerGuard);
    builder.overrideGuard(GuestOrAuthenticatedGuard).useValue(mockGuestGuard);
    const module: TestingModule = await builder.compile();
    controller = module.get<LinksController>(LinksController);
  });

  it('POST returns shortUrl, originalUrl, createdAt, expiresAt without userId', async () => {
    mockLinksService.create.mockResolvedValue(makeLink());
    const result = await controller.create(makeRegisteredRequest() as never, { url: TEST_URL });
    expect(result).toEqual({
      shortUrl: TEST_SLUG,
      originalUrl: TEST_URL,
      createdAt: expect.any(String),
      expiresAt: FUTURE_DATE.toISOString(),
    });
    expect(result).not.toHaveProperty('userId');
  });

  it('POST warms Redis cache with link key and TTL', async () => {
    mockLinksService.create.mockResolvedValue(makeLink());
    await controller.create(makeRegisteredRequest() as never, { url: TEST_URL });
    expect(mockRedisService.set).toHaveBeenCalledWith(
      `link:${TEST_SLUG}`,
      TEST_URL,
      expect.any(Number),
    );
  });

  it('POST routes a Guest principal through createGuest (no quota check)', async () => {
    mockLinksService.createGuest.mockResolvedValue(makeLink({ userId: GUEST_USER_ID }));
    await controller.create(makeGuestRequest() as never, { url: TEST_URL });
    expect(mockLinksService.createGuest).toHaveBeenCalledWith(TEST_URL, GUEST_USER_ID, undefined);
    expect(mockLinksService.create).not.toHaveBeenCalled();
  });

  it('POST routes a registered principal through create (quota-checked path)', async () => {
    mockLinksService.create.mockResolvedValue(makeLink());
    await controller.create(makeRegisteredRequest() as never, { url: TEST_URL });
    expect(mockLinksService.create).toHaveBeenCalledWith(TEST_URL, TEST_USER_ID, undefined);
    expect(mockLinksService.createGuest).not.toHaveBeenCalled();
  });

  it('GET returns wrapped list { data } and sanitized items', async () => {
    mockLinksService.listForUser.mockResolvedValue([makeLink()]);
    const result = await controller.list(makeRegisteredRequest() as never);
    expect(mockLinksService.listForUser).toHaveBeenCalledWith(TEST_USER_ID);
    expect(result).toHaveProperty('data');
    expect(result.data[0]).not.toHaveProperty('userId');
  });

  it('DELETE removes Redis key after service delete', async () => {
    mockLinksService.delete.mockResolvedValue(undefined);
    await controller.remove(makeRegisteredRequest() as never, TEST_SLUG);
    expect(mockLinksService.delete).toHaveBeenCalledWith(TEST_SLUG, TEST_USER_ID);
    expect(mockRedisService.del).toHaveBeenCalledWith(`link:${TEST_SLUG}`);
  });

  const NEW_URL = 'https://example.com/new-destination';

  it('PATCH returns the updated link and writes the new destination through the cache', async () => {
    mockLinksService.updateDestination.mockResolvedValue(makeLink({ originalUrl: NEW_URL }));
    const result = await controller.update(makeRegisteredRequest() as never, TEST_SLUG, {
      url: NEW_URL,
    });
    expect(mockLinksService.updateDestination).toHaveBeenCalledWith(
      TEST_SLUG,
      TEST_USER_ID,
      NEW_URL,
    );
    expect(result.originalUrl).toBe(NEW_URL);
    expect(result.shortUrl).toBe(TEST_SLUG);
    expect(mockRedisService.set).toHaveBeenCalledWith(
      `link:${TEST_SLUG}`,
      NEW_URL,
      expect.any(Number),
    );
    expect(mockRedisService.del).not.toHaveBeenCalled();
  });

  it('PATCH evicts the cache entry instead of re-caching an already-expired link', async () => {
    const PAST_DATE = new Date('2020-01-01T00:00:00Z');
    mockLinksService.updateDestination.mockResolvedValue(
      makeLink({ originalUrl: NEW_URL, expiresAt: PAST_DATE }),
    );
    await controller.update(makeRegisteredRequest() as never, TEST_SLUG, { url: NEW_URL });
    expect(mockRedisService.del).toHaveBeenCalledWith(`link:${TEST_SLUG}`);
    expect(mockRedisService.set).not.toHaveBeenCalled();
  });
});
