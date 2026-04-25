import { ModuleMetadata, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StatsService } from '../stats/stats.service';
import { RedirectController } from './redirect.controller';
import { RedirectService } from './redirect.service';

const TEST_SLUG = 'abc123';
const TEST_URL = 'https://example.com/x';
const TEST_IP = '1.2.3.4';

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

function makeMockReq(ip = TEST_IP): { ip: string; headers: Record<string, string> } {
  return { ip, headers: {} };
}

describe('RedirectController', () => {
  let controller: RedirectController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule(moduleMetadata).compile();
    controller = module.get<RedirectController>(RedirectController);
  });

  it('issues 302 redirect with Location on active link', async () => {
    mockRedirectService.resolve.mockResolvedValue({ status: 'active', originalUrl: TEST_URL });
    const res = makeMockRes();
    await controller.redirect(TEST_SLUG, res as never, makeMockReq() as never);
    expect(res.redirect).toHaveBeenCalledWith(HttpStatus.FOUND, TEST_URL);
  });

  it('throws NotFoundException for unknown slug', async () => {
    mockRedirectService.resolve.mockResolvedValue({ status: 'not-found' });
    const res = makeMockRes();
    const promise = controller.redirect(TEST_SLUG, res as never, makeMockReq() as never);
    await expect(promise).rejects.toThrow(NotFoundException);
  });

  it('throws 410 Gone for expired slug', async () => {
    mockRedirectService.resolve.mockResolvedValue({ status: 'expired' });
    const res = makeMockRes();
    const expectedStatus = expect.objectContaining({ status: HttpStatus.GONE });
    const promise = controller.redirect(TEST_SLUG, res as never, makeMockReq() as never);
    await expect(promise).rejects.toBeInstanceOf(HttpException);
    await expect(promise).rejects.toMatchObject(expectedStatus);
  });

  it('throws 404 for malformed slug length (defensive)', async () => {
    const res = makeMockRes();
    const promise = controller.redirect('toolong', res as never, makeMockReq() as never);
    await expect(promise).rejects.toThrow(NotFoundException);
    expect(mockRedirectService.resolve).not.toHaveBeenCalled();
  });

  it('records stats when redirect is served', async () => {
    mockRedirectService.resolve.mockResolvedValue({ status: 'active', originalUrl: TEST_URL });
    mockStatsService.record.mockResolvedValue(undefined);
    const res = makeMockRes();
    await controller.redirect(TEST_SLUG, res as never, makeMockReq() as never);
    expect(mockStatsService.record).toHaveBeenCalledWith(TEST_SLUG, TEST_IP, undefined);
  });
});
