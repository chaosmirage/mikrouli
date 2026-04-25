import { UnauthorizedException } from '@nestjs/common';
import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
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

const mockConfigService = {
  getOrThrow: jest.fn((key: string) => {
    if (key === 'JWT_SECRET') return TEST_JWT_SECRET;
    if (key === 'JWT_REFRESH_SECRET') return TEST_JWT_REFRESH_SECRET;
    throw new Error(`Unknown config key: ${key}`);
  }),
};

const jwtModuleConfig = { secret: TEST_JWT_SECRET, signOptions: { expiresIn: ACCESS_TOKEN_TTL } };
const usersServiceProvider = { provide: UsersService, useValue: mockUsersService };
const configServiceProvider = { provide: ConfigService, useValue: mockConfigService };

const moduleMetadata: ModuleMetadata = {
  imports: [JwtModule.register(jwtModuleConfig)],
  providers: [AuthService, usersServiceProvider, configServiceProvider],
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
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
    const passwordHashArg = (mockUsersService.create.mock.calls[0][0] as { passwordHash: string }).passwordHash;
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

  it('issueTokens access token expires in ≤ 900s', () => {
    const tokens = service.issueTokens(testUser);
    const rawPayload = Buffer.from(tokens.accessToken.split('.')[JWT_PART_PAYLOAD_INDEX], 'base64').toString();
    const payload = JSON.parse(rawPayload) as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(ACCESS_TOKEN_MAX_TTL_SECONDS);
  });

  it('rotateRefresh rejects invalid token', async () => {
    const rotateCall = service.rotateRefresh('garbage-token');
    await expect(rotateCall).rejects.toThrow(UnauthorizedException);
  });

  it('rotateRefresh issues new pair on valid token', async () => {
    mockUsersService.findById.mockResolvedValue(testUser);
    const original = service.issueTokens(testUser);
    const rotated = await service.rotateRefresh(original.refreshToken);
    expect(typeof rotated.accessToken).toBe('string');
    expect(typeof rotated.refreshToken).toBe('string');
    expect(rotated.accessToken.length).toBeGreaterThan(0);
  });
});
