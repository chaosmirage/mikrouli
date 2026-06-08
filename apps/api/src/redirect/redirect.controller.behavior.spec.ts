// Pins the observable HTTP status codes of RedirectController: active -> 302,
// expired -> 410 Gone, unknown -> 404.
import { ModuleMetadata, HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StatsService } from '../stats/stats.service';
import { RedirectController } from './redirect.controller';
import { RedirectService } from './redirect.service';

const TEST_SLUG = 'abc123';
const TEST_URL = 'https://example.com/x';

const mockRedirectService = { resolve: jest.fn() };
const mockStatsService = { record: jest.fn() };

const moduleMetadata: ModuleMetadata = {
  controllers: [RedirectController],
  providers: [
    { provide: RedirectService, useValue: mockRedirectService },
    { provide: StatsService, useValue: mockStatsService },
  ],
};

function makeMockRes(): { redirect: jest.Mock } {
  return { redirect: jest.fn() };
}

function makeMockReq(): { ip: string; headers: Record<string, string> } {
  return { ip: '1.2.3.4', headers: {} };
}

describe('RedirectController', () => {
  let controller: RedirectController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule(moduleMetadata).compile();
    controller = module.get<RedirectController>(RedirectController);
  });

  it('pins active link -> HTTP 302 (literal)', async () => {
    mockRedirectService.resolve.mockResolvedValue({ status: 'active', originalUrl: TEST_URL });
    const res = makeMockRes();
    await controller.redirect(TEST_SLUG, res as never, makeMockReq() as never);
    expect(res.redirect).toHaveBeenCalledWith(302, TEST_URL);
    expect(HttpStatus.FOUND).toBe(302);
  });

  it('pins expired link -> HTTP 410 Gone (literal)', async () => {
    mockRedirectService.resolve.mockResolvedValue({ status: 'expired' });
    const res = makeMockRes();
    try {
      await controller.redirect(TEST_SLUG, res as never, makeMockReq() as never);
      throw new Error('expected redirect to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(410);
    }
  });

  it('pins unknown slug -> HTTP 404 Not Found (literal)', async () => {
    mockRedirectService.resolve.mockResolvedValue({ status: 'not-found' });
    const res = makeMockRes();
    try {
      await controller.redirect(TEST_SLUG, res as never, makeMockReq() as never);
      throw new Error('expected redirect to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    }
  });
});
