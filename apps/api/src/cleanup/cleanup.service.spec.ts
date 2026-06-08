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

  it('returns 0 when no expired links exist (early return)', async () => {
    mockManager.find.mockResolvedValue([]);
    const count = await service.handleCleanup();
    expect(count).toBe(0);
    expect(mockManager.delete).not.toHaveBeenCalled();
    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  it('deletes expired links from PostgreSQL', async () => {
    mockManager.find.mockResolvedValue([makeExpiredLink()]);
    mockManager.delete.mockResolvedValue({ affected: 1 });
    const count = await service.handleCleanup();
    expect(count).toBe(1);
    expect(mockManager.delete).toHaveBeenCalledWith(Link, { shortUrl: TEST_SLUG });
  });

  it('deletes corresponding Redis key for each link', async () => {
    mockManager.find.mockResolvedValue([makeExpiredLink()]);
    mockManager.delete.mockResolvedValue({ affected: 1 });
    await service.handleCleanup();
    expect(mockRedis.del).toHaveBeenCalledWith(`link:${TEST_SLUG}`);
  });

  it('caps batch size at 1000 via TypeORM take option', async () => {
    mockManager.find.mockResolvedValue([]);
    await service.handleCleanup();
    const findCall = mockManager.find.mock.calls[0];
    const findOpts = findCall[1] as { take: number };
    expect(findOpts.take).toBe(1000);
  });

  it('continues processing when one delete fails', async () => {
    const a = makeExpiredLink('aaaaaa');
    const b = makeExpiredLink('bbbbbb');
    mockManager.find.mockResolvedValue([a, b]);
    mockManager.delete.mockRejectedValueOnce(new Error('boom'));
    mockManager.delete.mockResolvedValueOnce({ affected: 1 });
    const count = await service.handleCleanup();
    expect(count).toBe(1);
  });
});
