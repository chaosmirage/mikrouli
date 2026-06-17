import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BearerOrApiKeyGuard } from './bearer-or-api-key.guard';
import { GuestOrAuthenticatedGuard } from './guest-or-authenticated.guard';
import { UsersService } from '../users/users.service';

const GUEST_USER_ID = 'guest-uuid-fixed';

// A mutable request body the assertions can inspect after the guard runs.
interface MockRequest {
  headers: Record<string, string>;
  cookies: Record<string, string>;
  protocol?: string;
  user?: { id: string; isGuest: boolean };
}

// Builds a context whose getRequest returns the SAME MockRequest instance so
// the guard's mutation of `req.user` is observable by the test.
function buildMockContext(
  headers: Record<string, string>,
  cookies: Record<string, string> = {},
  protocol = 'http',
): { ctx: ExecutionContext; req: MockRequest } {
  const req: MockRequest = { headers, cookies, protocol };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

const mockBearerGuard = { canActivate: jest.fn() };
const mockUsersService = { getGuestUserId: jest.fn() };
const mockConfigService = { get: jest.fn() };

describe('GuestOrAuthenticatedGuard', () => {
  let guard: GuestOrAuthenticatedGuard;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockBearerGuard.canActivate.mockResolvedValue(true);
    mockUsersService.getGuestUserId.mockResolvedValue(GUEST_USER_ID);
    // Default: GUEST_SHORTEN_ENABLED=true, no PUBLIC_BASE_URL override.
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'GUEST_SHORTEN_ENABLED') return 'true';
      return undefined;
    });
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        GuestOrAuthenticatedGuard,
        { provide: BearerOrApiKeyGuard, useValue: mockBearerGuard },
        { provide: UsersService, useValue: mockUsersService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    guard = moduleRef.get<GuestOrAuthenticatedGuard>(GuestOrAuthenticatedGuard);
  });

  it('delegates to BearerOrApiKeyGuard when Authorization Bearer header is present', async () => {
    const { ctx } = buildMockContext({
      authorization: 'Bearer token',
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    });
    await guard.canActivate(ctx);
    expect(mockBearerGuard.canActivate).toHaveBeenCalledWith(ctx);
    expect(mockUsersService.getGuestUserId).not.toHaveBeenCalled();
  });

  it('delegates to BearerOrApiKeyGuard when x-api-key header is present', async () => {
    const { ctx } = buildMockContext({
      'x-api-key': 'mk_key',
      host: 'localhost:3000',
    });
    await guard.canActivate(ctx);
    expect(mockBearerGuard.canActivate).toHaveBeenCalledWith(ctx);
    expect(mockUsersService.getGuestUserId).not.toHaveBeenCalled();
  });

  it('delegates to BearerOrApiKeyGuard when access cookie is present', async () => {
    const { ctx } = buildMockContext({
      host: 'localhost:3000',
    }, { mikrouli_access: 'token' });
    await guard.canActivate(ctx);
    expect(mockBearerGuard.canActivate).toHaveBeenCalledWith(ctx);
    expect(mockUsersService.getGuestUserId).not.toHaveBeenCalled();
  });

  it('admits Guest when flag on, no credential, and Origin matches Host origin', async () => {
    const { ctx, req } = buildMockContext({
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockUsersService.getGuestUserId).toHaveBeenCalled();
    expect(req).toHaveProperty('user', { id: GUEST_USER_ID, isGuest: true });
  });

  it('admits Guest when Origin matches PUBLIC_BASE_URL override', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'GUEST_SHORTEN_ENABLED') return 'true';
      if (key === 'PUBLIC_BASE_URL') return 'https://mikrou.li';
      return undefined;
    });
    const { ctx, req } = buildMockContext({
      host: 'localhost:3000',
      origin: 'https://mikrou.li',
    });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req).toHaveProperty('user', { id: GUEST_USER_ID, isGuest: true });
  });

  it('rejects Guest when no Origin or Referer header (curl/script)', async () => {
    const { ctx } = buildMockContext({
      host: 'localhost:3000',
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(mockUsersService.getGuestUserId).not.toHaveBeenCalled();
  });

  it('rejects Guest when Origin does not match any allowed origin', async () => {
    const { ctx } = buildMockContext({
      host: 'localhost:3000',
      origin: 'https://evil.example.com',
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(mockUsersService.getGuestUserId).not.toHaveBeenCalled();
  });

  it('admits Guest when Referer matches Host origin (fallback when no Origin)', async () => {
    const { ctx, req } = buildMockContext({
      host: 'localhost:3000',
      referer: 'http://localhost:3000/',
    });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req).toHaveProperty('user', { id: GUEST_USER_ID, isGuest: true });
  });

  it('rejects Guest when Referer does not match any allowed origin', async () => {
    const { ctx } = buildMockContext({
      host: 'localhost:3000',
      referer: 'https://evil.example.com/',
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when flag is off and no credential is present', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'GUEST_SHORTEN_ENABLED') return 'false';
      return undefined;
    });
    const { ctx } = buildMockContext({
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(mockUsersService.getGuestUserId).not.toHaveBeenCalled();
  });

  it('defaults to flag-on when the env var is unset', async () => {
    mockConfigService.get.mockReturnValue(undefined);
    const { ctx } = buildMockContext({
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    });
    await guard.canActivate(ctx);
    expect(mockUsersService.getGuestUserId).toHaveBeenCalled();
  });

  it('treats non-"true" string values as flag-off', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'GUEST_SHORTEN_ENABLED') return '0';
      return undefined;
    });
    const { ctx } = buildMockContext({
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
