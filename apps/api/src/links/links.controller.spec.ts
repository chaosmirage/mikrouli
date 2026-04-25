import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';
import { RedisService } from '../redis/redis.service';
import { BearerOrApiKeyGuard } from '../api-keys/bearer-or-api-key.guard';
import type { Link } from './entities/link.entity';

const TEST_SLUG = 'abc123';
const TEST_URL = 'https://example.com/path';
const TEST_USER_ID = 'user-uuid';
const FUTURE_DATE = new Date('2099-01-01T00:00:00Z');

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

  it('POST returns shortUrl, originalUrl, createdAt, expiresAt without userId', async () => {
    mockLinksService.create.mockResolvedValue(makeLink());
    const result = await controller.create(makeRequest() as never, { url: TEST_URL });
    expect(result).toEqual({
      shortUrl: TEST_SLUG,
      originalUrl: TEST_URL,
      createdAt: expect.any(Date),
      expiresAt: FUTURE_DATE,
    });
    expect(result).not.toHaveProperty('userId');
  });

  it('POST warms Redis cache with link key and TTL', async () => {
    mockLinksService.create.mockResolvedValue(makeLink());
    await controller.create(makeRequest() as never, { url: TEST_URL });
    expect(mockRedisService.set).toHaveBeenCalledWith(
      `link:${TEST_SLUG}`,
      TEST_URL,
      expect.any(Number),
    );
  });

  it('GET returns wrapped list { data } and sanitized items', async () => {
    mockLinksService.listForUser.mockResolvedValue([makeLink()]);
    const result = await controller.list(makeRequest() as never);
    expect(mockLinksService.listForUser).toHaveBeenCalledWith(TEST_USER_ID);
    expect(result).toHaveProperty('data');
    expect(result.data[0]).not.toHaveProperty('userId');
  });

  it('DELETE removes Redis key after service delete', async () => {
    mockLinksService.delete.mockResolvedValue(undefined);
    await controller.remove(makeRequest() as never, TEST_SLUG);
    expect(mockLinksService.delete).toHaveBeenCalledWith(TEST_SLUG, TEST_USER_ID);
    expect(mockRedisService.del).toHaveBeenCalledWith(`link:${TEST_SLUG}`);
  });
});
