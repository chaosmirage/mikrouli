import { UnauthorizedException } from '@nestjs/common';
import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { User } from '../users/user.entity';

const TEST_JWT_SECRET = 'test-jwt-secret';
const TEST_JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
const ACCESS_TOKEN_TTL = '15m';
const ACCESS_TOKEN_MAX_TTL_SECONDS = 900;
const JWT_PART_PAYLOAD_INDEX = 1;

const testUser: User = {
  id: 'user-uuid-1',
  email: 'test@example.com',
  passwordHash: '$2b$10$placeholder',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockUsersService = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
};

const mockRedisService = {
  getOrThrow: jest.fn(),
  setOrThrow: jest.fn(),
  delOrThrow: jest.fn(),
};

const mockConfigService = {
  getOrThrow: jest.fn((key: string) => {
    if (key === 'JWT_SECRET') return TEST_JWT_SECRET;
    if (key === 'JWT_REFRESH_SECRET') return TEST_JWT_REFRESH_SECRET;
    throw new Error(`Unknown config key: ${key}`);
  }),
};

const jwtModuleConfig = { secret: TEST_JWT_SECRET, signOptions: { expiresIn: ACCESS_TOKEN_TTL } };
const usersServiceProvider = { provide: UsersService, useValue: mockUsersService };
const redisServiceProvider = { provide: RedisService, useValue: mockRedisService };
const configServiceProvider = { provide: ConfigService, useValue: mockConfigService };

const moduleMetadata: ModuleMetadata = {
  imports: [JwtModule.register(jwtModuleConfig)],
  providers: [AuthService, usersServiceProvider, redisServiceProvider, configServiceProvider],
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedisService.setOrThrow.mockResolvedValue(undefined);
    mockRedisService.delOrThrow.mockResolvedValue(undefined);
    const moduleRef: TestingModule = await Test.createTestingModule(moduleMetadata).compile();
    service = moduleRef.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('register hashes password with bcrypt', async () => {
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('$2b$10$fakehash' as never);
    mockUsersService.create.mockResolvedValue(testUser);
    await service.register({ email: testUser.email, password: 'Password1' });
    const passwordHashArg = (mockUsersService.create.mock.calls[0][0] as { passwordHash: string })
      .passwordHash;
    expect(passwordHashArg).toMatch(/^\$2/);
  });

  it('validateCredentials returns null when email not found', async () => {
    mockUsersService.findByEmail.mockResolvedValue(null);
    const result = await service.validateCredentials('unknown@example.com', 'Password1');
    expect(result).toBeNull();
  });

  it('validateCredentials returns null on wrong password', async () => {
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
    mockUsersService.findByEmail.mockResolvedValue(testUser);
    const result = await service.validateCredentials(testUser.email, 'WrongPassword1');
    expect(result).toBeNull();
  });

  it('issueTokens access token expires in ≤ 900s', async () => {
    const { tokens } = await service.issueTokens(testUser);
    const rawPayload = Buffer.from(
      tokens.accessToken.split('.')[JWT_PART_PAYLOAD_INDEX],
      'base64',
    ).toString();
    const payload = JSON.parse(rawPayload) as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(ACCESS_TOKEN_MAX_TTL_SECONDS);
  });

  it('issueTokens sets revocation entry in Redis', async () => {
    await service.issueTokens(testUser);
    expect(mockRedisService.setOrThrow).toHaveBeenCalledTimes(1);
    const [key, jti] = mockRedisService.setOrThrow.mock.calls[0] as [string, string, number];
    expect(key).toMatch(/^auth:refresh:/);
    expect(typeof jti).toBe('string');
    expect(jti.length).toBeGreaterThan(0);
  });

  it('issueTokens returns Set-Cookie header values for access and refresh cookies', async () => {
    const { cookies } = await service.issueTokens(testUser);
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain('mikrouli_access=');
    expect(cookies[0]).toContain('HttpOnly');
    expect(cookies[0]).toContain('Secure');
    expect(cookies[0]).toContain('SameSite=Strict');
    expect(cookies[0]).toContain('Path=/api');
    expect(cookies[1]).toContain('mikrouli_refresh=');
    expect(cookies[1]).toContain('Path=/api/auth');
  });

  it('issueTokens refresh JWT payload contains jti and family', async () => {
    const { tokens } = await service.issueTokens(testUser);
    const raw = Buffer.from(
      tokens.refreshToken.split('.')[JWT_PART_PAYLOAD_INDEX],
      'base64',
    ).toString();
    const payload = JSON.parse(raw) as { jti: string; family: string; type: string };
    expect(typeof payload.jti).toBe('string');
    expect(payload.jti.length).toBeGreaterThan(0);
    expect(typeof payload.family).toBe('string');
    expect(payload.family.length).toBeGreaterThan(0);
    expect(payload.type).toBe('refresh');
  });

  it('rotateRefresh rejects invalid token', async () => {
    const rotateCall = service.rotateRefresh('garbage-token');
    await expect(rotateCall).rejects.toThrow(UnauthorizedException);
  });

  it('rotateRefresh rejects when revocation key is absent (expired/revoked family)', async () => {
    mockRedisService.getOrThrow.mockResolvedValue(null);
    const { tokens } = await service.issueTokens(testUser);
    await expect(service.rotateRefresh(tokens.refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it('rotateRefresh revokes family and rejects on jti mismatch (replay detected)', async () => {
    // First issuance stores jti_v1 in the allowlist.
    mockRedisService.getOrThrow.mockResolvedValue('different-jti');
    const { tokens } = await service.issueTokens(testUser);
    await expect(service.rotateRefresh(tokens.refreshToken)).rejects.toThrow(UnauthorizedException);
    // The family must be deleted to contain the replay.
    expect(mockRedisService.delOrThrow).toHaveBeenCalledTimes(1);
  });

  it('rotateRefresh issues new pair when jti matches', async () => {
    mockUsersService.findById.mockResolvedValue(testUser);
    // Issue initial pair; the stored jti is captured from the setOrThrow call.
    const { tokens: initial } = await service.issueTokens(testUser);
    const storedJti = (mockRedisService.setOrThrow.mock.calls[0] as [string, string])[1];
    // Simulate the allowlist returning the matching jti.
    mockRedisService.getOrThrow.mockResolvedValue(storedJti);
    const { tokens: rotated } = await service.rotateRefresh(initial.refreshToken);
    expect(typeof rotated.accessToken).toBe('string');
    expect(typeof rotated.refreshToken).toBe('string');
    expect(rotated.accessToken.length).toBeGreaterThan(0);
  });

  it('revokeRefresh deletes the revocation key for the token family', async () => {
    const { tokens } = await service.issueTokens(testUser);
    await service.revokeRefresh(tokens.refreshToken);
    // delOrThrow is called once for the family key.
    expect(mockRedisService.delOrThrow).toHaveBeenCalledTimes(1);
    const [key] = mockRedisService.delOrThrow.mock.calls[0] as [string];
    expect(key).toMatch(/^auth:refresh:/);
  });

  it('revokeRefresh is a no-op on an invalid token (already-absent/expired)', async () => {
    await service.revokeRefresh('garbage-token');
    expect(mockRedisService.delOrThrow).not.toHaveBeenCalled();
  });
});
