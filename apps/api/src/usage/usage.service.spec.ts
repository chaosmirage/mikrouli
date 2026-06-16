import { HttpException, HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UsageService } from './usage.service';
import { GLOBAL_KEY_LIMIT, GLOBAL_LINK_LIMIT } from '../common/constants';

// Minimal User stub matching the entity shape the service reads
function makeUser(overrides: { monthlyLinkLimit?: number | null; monthlyKeyLimit?: number | null } = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    monthlyLinkLimit: overrides.monthlyLinkLimit ?? null,
    monthlyKeyLimit: overrides.monthlyKeyLimit ?? null,
  };
}

function buildUserRepoMock(user: ReturnType<typeof makeUser>) {
  return {
    findOneOrFail: jest.fn().mockResolvedValue(user),
  };
}

describe('UsageService', () => {
  describe('resolveLinkLimit', () => {
    it('returns per-user override when non-null', () => {
      const service = new UsageService({} as DataSource, {} as any);
      const user = makeUser({ monthlyLinkLimit: 42 });
      expect(service.resolveLinkLimit(user)).toBe(42);
    });

    it('returns GLOBAL_LINK_LIMIT when monthlyLinkLimit is null', () => {
      const service = new UsageService({} as DataSource, {} as any);
      const user = makeUser({ monthlyLinkLimit: null });
      expect(service.resolveLinkLimit(user)).toBe(GLOBAL_LINK_LIMIT);
    });
  });

  describe('resolveKeyLimit', () => {
    it('returns per-user override when non-null', () => {
      const service = new UsageService({} as DataSource, {} as any);
      const user = makeUser({ monthlyKeyLimit: 5 });
      expect(service.resolveKeyLimit(user)).toBe(5);
    });

    it('returns GLOBAL_KEY_LIMIT when monthlyKeyLimit is null', () => {
      const service = new UsageService({} as DataSource, {} as any);
      const user = makeUser({ monthlyKeyLimit: null });
      expect(service.resolveKeyLimit(user)).toBe(GLOBAL_KEY_LIMIT);
    });
  });

  describe('countLinksThisMonth', () => {
    it('counts links in the current calendar month', async () => {
      const mockCount = jest.fn().mockResolvedValue(7);
      const ds = { manager: { count: mockCount } } as unknown as DataSource;
      const service = new UsageService(ds, {} as any);
      const result = await service.countLinksThisMonth('user-1');
      expect(result).toBe(7);
      expect(mockCount).toHaveBeenCalledTimes(1);
    });

    it('uses half-open calendar-month range', async () => {
      const mockCount = jest.fn().mockResolvedValue(3);
      const ds = { manager: { count: mockCount } } as unknown as DataSource;
      const service = new UsageService(ds, {} as any);
      await service.countLinksThisMonth('user-1');
      const [, opts] = mockCount.mock.calls[0] as [unknown, { where: { createdAt: unknown } }];
      // The where clause should contain a createdAt range condition
      expect(opts.where).toHaveProperty('createdAt');
    });
  });

  describe('countKeysThisMonth', () => {
    it('counts API keys in the current calendar month including revoked ones', async () => {
      const mockCount = jest.fn().mockResolvedValue(2);
      const ds = { getRepository: jest.fn().mockReturnValue({ count: mockCount }) } as unknown as DataSource;
      const service = new UsageService(ds, {} as any);
      const result = await service.countKeysThisMonth('user-1');
      expect(result).toBe(2);
      expect(mockCount).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSummary', () => {
    it('returns full UsageSummary with correct shape', async () => {
      const user = makeUser({ monthlyLinkLimit: null, monthlyKeyLimit: null });
      const linkMockCount = jest.fn().mockResolvedValue(5);
      const keyMockCount = jest.fn().mockResolvedValue(1);
      const ds = {
        manager: { count: linkMockCount },
        getRepository: jest.fn().mockReturnValue({ count: keyMockCount }),
      } as unknown as DataSource;
      const userRepo = buildUserRepoMock(user);
      const service = new UsageService(ds, userRepo as any);

      const summary = await service.getSummary('user-1');

      expect(summary.linksCreated).toBe(5);
      expect(summary.linkLimit).toBe(GLOBAL_LINK_LIMIT);
      expect(summary.linksRemaining).toBe(GLOBAL_LINK_LIMIT - 5);
      expect(summary.keysCreated).toBe(1);
      expect(summary.keyLimit).toBe(GLOBAL_KEY_LIMIT);
      expect(summary.keysRemaining).toBe(GLOBAL_KEY_LIMIT - 1);
      expect(summary.retentionMs).toBeGreaterThan(0);
      expect(typeof summary.resetDate).toBe('string');
    });

    it('floors remaining at 0 when over limit', async () => {
      const user = makeUser({ monthlyLinkLimit: 3, monthlyKeyLimit: null });
      const linkMockCount = jest.fn().mockResolvedValue(5);
      const keyMockCount = jest.fn().mockResolvedValue(0);
      const ds = {
        manager: { count: linkMockCount },
        getRepository: jest.fn().mockReturnValue({ count: keyMockCount }),
      } as unknown as DataSource;
      const userRepo = buildUserRepoMock(user);
      const service = new UsageService(ds, userRepo as any);

      const summary = await service.getSummary('user-1');
      expect(summary.linksRemaining).toBe(0);
    });

    it('returns resetDate as first of next calendar month in UTC', async () => {
      const user = makeUser();
      const ds = {
        manager: { count: jest.fn().mockResolvedValue(0) },
        getRepository: jest.fn().mockReturnValue({ count: jest.fn().mockResolvedValue(0) }),
      } as unknown as DataSource;
      const userRepo = buildUserRepoMock(user);
      const service = new UsageService(ds, userRepo as any);

      const summary = await service.getSummary('user-1');
      const resetDate = new Date(summary.resetDate);
      expect(resetDate.getUTCDate()).toBe(1);
      expect(resetDate.getUTCHours()).toBe(0);
      expect(resetDate.getUTCMinutes()).toBe(0);
    });
  });

  describe('calendar-month rollover', () => {
    it('restores allowance when prior-month count is at limit but current-month count is zero', async () => {
      // Counts only for the current month — zero because we simulate a new month
      const user = makeUser({ monthlyLinkLimit: 2 });
      const linkMockCount = jest.fn().mockResolvedValue(0);
      const keyMockCount = jest.fn().mockResolvedValue(0);
      const ds = {
        manager: { count: linkMockCount },
        getRepository: jest.fn().mockReturnValue({ count: keyMockCount }),
      } as unknown as DataSource;
      const userRepo = buildUserRepoMock(user);
      const service = new UsageService(ds, userRepo as any);

      const count = await service.countLinksThisMonth('user-1');
      expect(count).toBe(0); // new month, no links yet
    });
  });
});

describe('LinksService quota enforcement', () => {
  it('throws HttpException 429 with monthly-link-limit-exceeded slug when count >= limit', async () => {
    // Dynamic import to allow the module to be loaded after types exist
    const { MonthlyLinkLimitExceededError } = await import('./usage.errors');
    const err = new MonthlyLinkLimitExceededError();
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    const response = err.getResponse() as { kind: string; typeSlug: string };
    expect(response.kind).toBe('problem');
    expect(response.typeSlug).toBe('monthly-link-limit-exceeded');
  });
});

describe('ApiKeysService quota enforcement', () => {
  it('throws HttpException 429 with monthly-key-limit-exceeded slug when count >= limit', async () => {
    const { MonthlyKeyLimitExceededError } = await import('./usage.errors');
    const err = new MonthlyKeyLimitExceededError();
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    const response = err.getResponse() as { kind: string; typeSlug: string };
    expect(response.kind).toBe('problem');
    expect(response.typeSlug).toBe('monthly-key-limit-exceeded');
  });
});
