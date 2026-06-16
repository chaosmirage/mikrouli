import { ModuleMetadata, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsNull } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { ApiKeysService } from './api-keys.service';
import { ApiKey } from './api-key.entity';
import { User } from '../users/user.entity';
import { UsageService } from '../usage/usage.service';
import { MonthlyKeyLimitExceededError } from '../usage/usage.errors';

const BCRYPT_HASH_ROUNDS = 10;
const TEST_PLAINTEXT = 'mk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const TEST_KEY_PREFIX = TEST_PLAINTEXT.slice(3, 11);
const TEST_USER_ID = 'user-uuid-test';
const TEST_KEY_ID = 'key-uuid-test';

const mockRepository = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
});

const mockUsageService = {
  countKeysThisMonth: jest.fn().mockResolvedValue(0),
  getKeyLimit: jest.fn().mockResolvedValue(10),
};

const moduleMetadata: ModuleMetadata = {
  providers: [
    ApiKeysService,
    { provide: getRepositoryToken(ApiKey), useFactory: mockRepository },
    { provide: UsageService, useValue: mockUsageService },
  ],
};

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let repo: jest.Mocked<Repository<ApiKey>>;
  let testKeyHash: string;

  beforeAll(async () => {
    testKeyHash = await bcrypt.hash(TEST_PLAINTEXT, BCRYPT_HASH_ROUNDS);
  });

  beforeEach(async () => {
    mockUsageService.countKeysThisMonth.mockResolvedValue(0);
    mockUsageService.getKeyLimit.mockResolvedValue(10);
    const moduleRef: TestingModule = await Test.createTestingModule(moduleMetadata).compile();
    service = moduleRef.get<ApiKeysService>(ApiKeysService);
    repo = moduleRef.get(getRepositoryToken(ApiKey));
  });

  it('createForUser persists hashed key and returns plaintext once', async () => {
    repo.create.mockImplementation((data: Partial<ApiKey>) => data as ApiKey);
    repo.save.mockImplementation((e: ApiKey) =>
      Promise.resolve({ ...e, id: TEST_KEY_ID, createdAt: new Date() } as ApiKey),
    );
    const result = await service.createForUser(TEST_USER_ID, { label: 'Test' });
    expect(result.key).toMatch(/^mk_/);
    expect(result.key.length).toBeGreaterThanOrEqual(35);
    expect(result).not.toHaveProperty('keyHash');
  });

  it('createForUser stores bcrypt hash and 8-char prefix; never plaintext', async () => {
    let captured: Partial<ApiKey> = {};
    repo.create.mockImplementation((data: Partial<ApiKey>) => {
      captured = data;
      return data as ApiKey;
    });
    repo.save.mockImplementation((e: ApiKey) =>
      Promise.resolve({ ...e, id: TEST_KEY_ID, createdAt: new Date() } as ApiKey),
    );
    const result = await service.createForUser(TEST_USER_ID, { label: 'Test' });
    expect(captured.keyHash).toMatch(/^\$2/);
    expect(captured.keyPrefix).toHaveLength(8);
    expect(captured.keyHash).not.toEqual(result.key);
  });

  it('validate returns null for unknown prefix', async () => {
    repo.findOne.mockResolvedValue(null);
    const result = await service.validate('mk_unknownprefix1234567890');
    expect(result).toBeNull();
  });

  it('validate findOne filters by revokedAt IS NULL', async () => {
    repo.findOne.mockResolvedValue(null);
    await service.validate('mk_unknownprefix1234567890');
    expect(repo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ revokedAt: IsNull() }) }),
    );
  });

  it('validate returns userId on match and triggers last_used_at update', async () => {
    const mockKey = {
      id: TEST_KEY_ID,
      userId: TEST_USER_ID,
      keyHash: testKeyHash,
      keyPrefix: TEST_KEY_PREFIX,
      revokedAt: null,
      label: 'Test',
      createdAt: new Date(),
      lastUsedAt: null,
      user: {} as User,
    };
    repo.findOne.mockResolvedValue(mockKey);
    repo.update.mockResolvedValue({ affected: 1 } as never);
    const result = await service.validate(TEST_PLAINTEXT);
    expect(result).toEqual({ userId: TEST_USER_ID });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(repo.update).toHaveBeenCalledWith(
      TEST_KEY_ID,
      expect.objectContaining({ lastUsedAt: expect.any(Date) }),
    );
  });

  it('revoke throws NotFoundException when no rows match (ownership check)', async () => {
    repo.update.mockResolvedValue({ affected: 0 } as never);
    await expect(service.revoke(TEST_USER_ID, TEST_KEY_ID)).rejects.toThrow(NotFoundException);
  });

  it('createForUser rejects with MonthlyKeyLimitExceededError when monthly limit is reached', async () => {
    mockUsageService.countKeysThisMonth.mockResolvedValue(10);
    mockUsageService.getKeyLimit.mockResolvedValue(10);
    await expect(service.createForUser(TEST_USER_ID, { label: 'Test' })).rejects.toThrow(
      MonthlyKeyLimitExceededError,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('listForUser does not include keyHash or plaintext', async () => {
    const stubKey = {
      id: 'k1',
      label: 'Key 1',
      keyPrefix: 'abcdefgh',
      keyHash: '$2b$10$fake',
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: null,
      userId: TEST_USER_ID,
      user: {} as User,
    };
    repo.find.mockResolvedValue([stubKey]);
    const result = await service.listForUser(TEST_USER_ID);
    expect(result[0]).not.toHaveProperty('keyHash');
    expect(result[0]).not.toHaveProperty('key');
    expect(result[0]).toHaveProperty('keyPrefix');
  });
});
