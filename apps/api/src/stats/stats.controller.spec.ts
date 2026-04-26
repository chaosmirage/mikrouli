import { ForbiddenException, ModuleMetadata, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BearerOrApiKeyGuard } from '../api-keys/bearer-or-api-key.guard';
import { LinksService } from '../links/links.service';
import { AggregatedStats, StatsService } from './stats.service';
import { StatsController } from './stats.controller';

const TEST_SLUG = 'abc123';
const TEST_USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';

const mockStatsService = { record: jest.fn(), getStats: jest.fn() };
const mockLinksService = { findBySlug: jest.fn() };
const mockGuard = { canActivate: () => true };

const EMPTY_STATS: AggregatedStats = {
  totalClicks: 0,
  clicksByDay: [],
  topCountries: [],
  topBrowsers: [],
};

const moduleMetadata: ModuleMetadata = {
  controllers: [StatsController],
  providers: [
    { provide: StatsService, useValue: mockStatsService },
    { provide: LinksService, useValue: mockLinksService },
  ],
};

function makeLink(userId: string): { shortUrl: string; userId: string } {
  return { shortUrl: TEST_SLUG, userId };
}

function makeReq(userId: string): { user: { id: string } } {
  return { user: { id: userId } };
}

describe('StatsController', () => {
  let controller: StatsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const builder = Test.createTestingModule(moduleMetadata);
    builder.overrideGuard(BearerOrApiKeyGuard).useValue(mockGuard);
    const module: TestingModule = await builder.compile();
    controller = module.get<StatsController>(StatsController);
  });

  it('BearerOrApiKeyGuard is applied to controller class', () => {
    const guards: unknown[] = Reflect.getMetadata('__guards__', StatsController) ?? [];
    expect(guards).toContain(BearerOrApiKeyGuard);
  });

  it('returns stats for the link owner', async () => {
    mockLinksService.findBySlug.mockResolvedValue(makeLink(TEST_USER_ID));
    mockStatsService.getStats.mockResolvedValue(EMPTY_STATS);
    const result = await controller.getStats(TEST_SLUG, makeReq(TEST_USER_ID) as never);
    expect(result).toEqual({
      slug: TEST_SLUG,
      totalClicks: 0,
      byDay: [],
      byCountry: [],
      byBrowser: [],
    });
  });

  it('throws NotFoundException when link does not exist', async () => {
    mockLinksService.findBySlug.mockResolvedValue(null);
    const promise = controller.getStats(TEST_SLUG, makeReq(TEST_USER_ID) as never);
    await expect(promise).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when link belongs to different user', async () => {
    mockLinksService.findBySlug.mockResolvedValue(makeLink(OTHER_USER_ID));
    const promise = controller.getStats(TEST_SLUG, makeReq(TEST_USER_ID) as never);
    await expect(promise).rejects.toThrow(ForbiddenException);
  });
});
