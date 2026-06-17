import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { GithubOauthGuard } from './github.strategy';
import { GithubNoVerifiedEmailError, GithubOauthFailedError } from './github-oauth.errors';
import type { GithubIdentity } from './github-oauth.errors';

const ACCESS_COOKIE =
  'mikrouli_access=token; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=900';
const REFRESH_COOKIE =
  'mikrouli_refresh=rtoken; Path=/api/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=604800';

const publicUser = {
  id: 'uuid-1',
  email: 'test@example.com',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
};

const githubIdentity: GithubIdentity = {
  provider: 'github',
  providerUserId: 'gh-id-123',
  email: 'test@example.com',
};

const mockAuthService = {
  register: jest.fn(),
  validateCredentials: jest.fn(),
  issueTokens: jest.fn(),
  rotateRefresh: jest.fn(),
  revokeRefresh: jest.fn(),
  loginWithGithub: jest.fn(),
};

const mockUsersService = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
};

function buildMockResponse() {
  const headers: Record<string, string[]> = {};
  let statusCode = 200;
  let redirectTarget = '';
  return {
    setHeader: jest.fn((name: string, value: string | string[]) => {
      headers[name] = Array.isArray(value) ? value : [value];
    }),
    getHeaders: () => headers,
    status: jest.fn().mockReturnThis(),
    redirect: jest.fn((code: number, url: string) => {
      statusCode = code;
      redirectTarget = url;
    }),
    getRedirectTarget: () => redirectTarget,
    getStatusCode: () => statusCode,
  };
}

const authServiceProvider = { provide: AuthService, useValue: mockAuthService };
const usersServiceProvider = { provide: UsersService, useValue: mockUsersService };

// Build module with guards overridden — in unit tests we bypass the passport guard
const moduleMetadata: ModuleMetadata = {
  imports: [ThrottlerModule.forRoot({ throttlers: [{ limit: 100, ttl: 60_000 }] })],
  controllers: [AuthController],
  providers: [
    authServiceProvider,
    usersServiceProvider,
    { provide: ThrottlerGuard, useValue: { canActivate: () => true } },
  ],
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule(moduleMetadata)
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(GithubOauthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = moduleRef.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // Credential-path regression tests

  it('POST /register returns id+email+createdAt without passwordHash', async () => {
    mockAuthService.register.mockResolvedValue(publicUser);
    const result = await controller.register({ email: 'test@example.com', password: 'Password1' });
    expect(result).toEqual({
      id: 'uuid-1',
      email: 'test@example.com',
      createdAt: publicUser.createdAt.toISOString(),
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('POST /login sets session cookies and returns user profile', async () => {
    const dbUser = {
      id: publicUser.id,
      email: publicUser.email,
      createdAt: publicUser.createdAt,
      passwordHash: 'x',
      updatedAt: new Date(),
    };
    mockAuthService.validateCredentials.mockResolvedValue(dbUser);
    mockAuthService.issueTokens.mockResolvedValue({
      tokens: { accessToken: 'token', refreshToken: 'rtoken' },
      cookies: [ACCESS_COOKIE, REFRESH_COOKIE],
    });
    const res = buildMockResponse();
    const result = await controller.login(
      { email: 'test@example.com', password: 'Password1' },
      res as never,
    );
    expect(result).toMatchObject({ id: publicUser.id, email: publicUser.email });
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', [ACCESS_COOKIE, REFRESH_COOKIE]);
  });

  it('POST /login throws 401 on invalid credentials', async () => {
    mockAuthService.validateCredentials.mockResolvedValue(null);
    const res = buildMockResponse();
    const loginCall = controller.login(
      { email: 'test@example.com', password: 'wrong' },
      res as never,
    );
    await expect(loginCall).rejects.toThrow(UnauthorizedException);
  });

  it('POST /logout returns void and clears cookies on success', async () => {
    mockAuthService.revokeRefresh.mockResolvedValue(undefined);
    const req = { cookies: { mikrouli_refresh: 'rtoken' } };
    const res = buildMockResponse();
    await controller.logout(req as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.arrayContaining([
        expect.stringContaining('mikrouli_access=;'),
        expect.stringContaining('mikrouli_refresh=;'),
      ]),
    );
  });

  it('POST /logout clears cookies when no refresh cookie is present (idempotent)', async () => {
    const req = { cookies: {} };
    const res = buildMockResponse();
    await controller.logout(req as never, res as never);
    expect(mockAuthService.revokeRefresh).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.arrayContaining([expect.stringContaining('Max-Age=0')]),
    );
  });

  it('POST /logout throws 503 without clearing cookies on Redis failure', async () => {
    mockAuthService.revokeRefresh.mockRejectedValue(new Error('Redis down'));
    const req = { cookies: { mikrouli_refresh: 'rtoken' } };
    const res = buildMockResponse();
    await expect(controller.logout(req as never, res as never)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  // GitHub OAuth callback -- success path

  it('GET /auth/github/callback redirects to /dashboard and sets session cookies on success', async () => {
    mockAuthService.loginWithGithub.mockResolvedValue({
      tokens: { accessToken: 'access', refreshToken: 'refresh' },
      cookies: [ACCESS_COOKIE, REFRESH_COOKIE],
    });
    const req = { user: githubIdentity };
    const res = buildMockResponse();

    await controller.githubCallback(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', [ACCESS_COOKIE, REFRESH_COOKIE]);
    expect(res.redirect).toHaveBeenCalledWith(302, '/dashboard');
  });

  // GithubOauthRedirectFilter maps typed OAuth errors to a redirect

  it('GithubOauthRedirectFilter redirects to /login?error=github-oauth-failed for GithubOauthFailedError', () => {
    // Import and test the filter directly since we cannot unit-test NestJS filter routing here
    // The filter is tested by instantiating it and calling catch() with a mock host
    const { GithubOauthRedirectFilter } = jest.requireActual('./github-oauth.errors') as {
      GithubOauthRedirectFilter: new () => { catch: (err: unknown, host: unknown) => void };
    };
    const filter = new GithubOauthRedirectFilter();

    const mockRes = { redirect: jest.fn() };
    const mockHost = {
      switchToHttp: () => ({ getResponse: () => mockRes }),
    };

    filter.catch(new GithubOauthFailedError(), mockHost);
    expect(mockRes.redirect).toHaveBeenCalledWith(302, '/login?error=github-oauth-failed');
  });

  it('GithubOauthRedirectFilter redirects to /login?error=github-no-verified-email for GithubNoVerifiedEmailError', () => {
    const { GithubOauthRedirectFilter } = jest.requireActual('./github-oauth.errors') as {
      GithubOauthRedirectFilter: new () => { catch: (err: unknown, host: unknown) => void };
    };
    const filter = new GithubOauthRedirectFilter();

    const mockRes = { redirect: jest.fn() };
    const mockHost = {
      switchToHttp: () => ({ getResponse: () => mockRes }),
    };

    filter.catch(new GithubNoVerifiedEmailError(), mockHost);
    expect(mockRes.redirect).toHaveBeenCalledWith(302, '/login?error=github-no-verified-email');
  });
});
