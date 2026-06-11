import * as crypto from 'crypto';
import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

const TEST_JWT_SECRET = 'test-jwt-secret-for-algo-pin';
const ACCESS_COOKIE_NAME = 'mikrouli_access';

const mockConfigService = {
  getOrThrow: jest.fn((key: string) => {
    if (key === 'JWT_SECRET') return TEST_JWT_SECRET;
    throw new Error(`Unknown config key: ${key}`);
  }),
};

const configServiceProvider = { provide: ConfigService, useValue: mockConfigService };

const moduleMetadata: ModuleMetadata = {
  imports: [JwtModule.register({ secret: TEST_JWT_SECRET })],
  providers: [JwtStrategy, configServiceProvider],
};

/**
 * Builds a structurally valid JWT signed with HS384 using Node's crypto
 * module directly. No extra dependencies are needed; HS384 is a valid HMAC
 * variant that jsonwebtoken accepts without an algorithm constraint, making
 * it suitable for testing that the strategy pin blocks non-HS256 algorithms.
 */
function buildHs384Token(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS384', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }),
  ).toString('base64url');
  const sigInput = `${header}.${body}`;
  const signature = crypto.createHmac('sha384', secret).update(sigInput).digest('base64url');
  return `${sigInput}.${signature}`;
}

/**
 * Wraps the passport strategy's authenticate() to return a promise resolving
 * to the validated user or rejecting on authentication failure.
 * This exercises the full passport-jwt verification path: token extraction ->
 * signature + algorithm check -> validate callback.
 */
function authenticateWithToken(
  strategy: JwtStrategy,
  token: string,
  useCookie = false,
): Promise<{ id: string; email: string }> {
  return new Promise((resolve, reject) => {
    const fakeReq = useCookie
      ? { headers: {}, cookies: { [ACCESS_COOKIE_NAME]: token } }
      : { headers: { authorization: `Bearer ${token}` }, cookies: {} };

    // Patch success/fail/error on the strategy instance for this invocation so
    // we can capture the outcome without needing a real HTTP server.
    const s = strategy as unknown as Record<string, unknown>;
    const saved = { success: s['success'], fail: s['fail'], error: s['error'] };

    const restore = () => Object.assign(s, saved);

    s['success'] = (user: { id: string; email: string }) => {
      restore();
      resolve(user);
    };
    s['fail'] = (challenge: unknown) => {
      restore();
      reject(new Error(String(challenge)));
    };
    s['error'] = (err: unknown) => {
      restore();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    (strategy as unknown as { authenticate: (req: unknown) => void }).authenticate(fakeReq);
  });
}

describe('JwtStrategy algorithm pin', () => {
  let strategy: JwtStrategy;
  let jwtService: JwtService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule(moduleMetadata).compile();
    strategy = moduleRef.get<JwtStrategy>(JwtStrategy);
    jwtService = moduleRef.get<JwtService>(JwtService);
  });

  it('accepts a valid HS256-signed access token via Bearer header', async () => {
    const token = jwtService.sign(
      { sub: 'user-1', email: 'user@example.com' },
      { algorithm: 'HS256', secret: TEST_JWT_SECRET },
    );

    const user = await authenticateWithToken(strategy, token);

    expect(user).toEqual({ id: 'user-1', email: 'user@example.com' });
  });

  it('accepts a valid HS256-signed access token via the mikrouli_access cookie', async () => {
    const token = jwtService.sign(
      { sub: 'user-1', email: 'user@example.com' },
      { algorithm: 'HS256', secret: TEST_JWT_SECRET },
    );

    const user = await authenticateWithToken(strategy, token, true);

    expect(user).toEqual({ id: 'user-1', email: 'user@example.com' });
  });

  it('rejects a token signed with HS384 (non-HS256 algorithm)', async () => {
    // Without an algorithm pin, jsonwebtoken accepts any HMAC-family token
    // (HS256/HS384/HS512) when given a symmetric secret. With algorithms:['HS256']
    // the strategy must reject HS384 even though the signature is cryptographically valid.
    const hs384Token = buildHs384Token(
      { sub: 'user-1', email: 'user@example.com' },
      TEST_JWT_SECRET,
    );

    await expect(authenticateWithToken(strategy, hs384Token)).rejects.toThrow();
  });
});
