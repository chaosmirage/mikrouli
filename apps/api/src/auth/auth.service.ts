import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { User } from '../users/user.entity';

const BCRYPT_SALT_ROUNDS = 10;
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const REFRESH_TOKEN_TYPE = 'refresh';
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

// Cookie attribute constants
const ACCESS_COOKIE_NAME = 'mikrouli_access';
const REFRESH_COOKIE_NAME = 'mikrouli_refresh';
const ACCESS_COOKIE_PATH = '/api';
const REFRESH_COOKIE_PATH = '/api/auth';

// Redis key prefix for the refresh-token revocation allowlist.
// Key: auth:refresh:<family>  Value: current jti  TTL: refresh TTL
const REVOCATION_KEY_PREFIX = 'auth:refresh:';

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
  type?: string;
  jti?: string;
  family?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  createdAt: Date;
}

export interface CookiePair {
  accessCookie: string;
  refreshCookie: string;
}

function buildRevocationKey(family: string): string {
  return `${REVOCATION_KEY_PREFIX}${family}`;
}

function buildClearCookieValue(name: string, path: string): string {
  // Max-Age=0 instructs the browser to delete the cookie immediately.
  return `${name}=; Path=${path}; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function buildAccessPayload(user: User): JwtPayload {
  return { sub: user.id, email: user.email };
}

function buildRefreshPayload(user: User, jti: string, family: string): JwtPayload {
  return { sub: user.id, email: user.email, type: REFRESH_TOKEN_TYPE, jti, family };
}

function decodeRefreshToken(jwtService: JwtService, token: string, secret: string): JwtPayload {
  try {
    return jwtService.verify<JwtPayload>(token, { secret, algorithms: ['HS256'] });
  } catch {
    throw new UnauthorizedException();
  }
}

function assertRefreshType(payload: JwtPayload): void {
  if (payload.type !== REFRESH_TOKEN_TYPE) throw new UnauthorizedException();
}

function assertRefreshClaims(
  payload: JwtPayload,
): asserts payload is JwtPayload & { jti: string; family: string } {
  if (!payload.jti || !payload.family) throw new UnauthorizedException();
}

function buildSetCookieHeader(name: string, value: string, path: string, maxAge: number): string {
  return `${name}=${value}; Path=${path}; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function buildClearCookieHeaders(): [string, string] {
  return [
    buildClearCookieValue(ACCESS_COOKIE_NAME, ACCESS_COOKIE_PATH),
    buildClearCookieValue(REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH),
  ];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async register(dto: { email: string; password: string }): Promise<PublicUser> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = await this.usersService.create({ email: dto.email, passwordHash });
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }

  async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const match = await bcrypt.compare(password, user.passwordHash);
    return match ? user : null;
  }

  async issueTokens(user: User): Promise<{ tokens: TokenPair; cookies: [string, string] }> {
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const jti = crypto.randomUUID();
    const family = crypto.randomUUID();
    const refreshOptions = { secret: refreshSecret, expiresIn: REFRESH_TOKEN_TTL };

    const accessToken = this.jwtService.sign(buildAccessPayload(user));
    const refreshToken = this.jwtService.sign(
      buildRefreshPayload(user, jti, family),
      refreshOptions,
    );

    // Store jti in the revocation allowlist — fail-closed if Redis is unavailable.
    const revocationKey = buildRevocationKey(family);
    await this.redisService.setOrThrow(revocationKey, jti, REFRESH_TOKEN_TTL_SECONDS);

    const cookies: [string, string] = [
      buildSetCookieHeader(ACCESS_COOKIE_NAME, accessToken, ACCESS_COOKIE_PATH, ACCESS_TOKEN_TTL_SECONDS),
      buildSetCookieHeader(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_PATH, REFRESH_TOKEN_TTL_SECONDS),
    ];

    return { tokens: { accessToken, refreshToken }, cookies };
  }

  async rotateRefresh(token: string): Promise<{ tokens: TokenPair; cookies: [string, string] }> {
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const payload = decodeRefreshToken(this.jwtService, token, refreshSecret);
    assertRefreshType(payload);
    assertRefreshClaims(payload);

    const revocationKey = buildRevocationKey(payload.family);

    // Fail-closed: any Redis error surfaces as 503 rather than silently granting access.
    const storedJti = await this.redisService.getOrThrow(revocationKey);

    if (storedJti === null) {
      // Key absent means the family was never issued or already revoked.
      throw new UnauthorizedException();
    }

    if (storedJti !== payload.jti) {
      // Reuse of a superseded token — revoke the entire family to contain replay.
      await this.redisService.delOrThrow(revocationKey);
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();

    // Issue new tokens — setOrThrow in issueTokens overwrites the stored jti.
    return this.issueTokens(user);
  }

  async revokeRefresh(token: string): Promise<void> {
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: refreshSecret,
        algorithms: ['HS256'],
      });
    } catch {
      // Invalid or expired token — nothing to revoke; treat as already-absent (204).
      return;
    }

    if (!payload.family) return;

    // Throws on Redis error — the caller returns 503 and does NOT clear cookies.
    await this.redisService.delOrThrow(buildRevocationKey(payload.family));
  }
}

// Exported for use in the controller when setting response headers.
export { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, buildClearCookieValue };
