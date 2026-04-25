import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService, ApiKeySummary, CreatedApiKey } from './api-keys.service';

type AuthedReq = Request & { user: { id: string } };

const TEST_USER_ID = 'user-uuid-ctrl';
const TEST_KEY_ID = 'key-uuid-ctrl';

const mockApiKeysService = {
  createForUser: jest.fn(),
  listForUser: jest.fn(),
  revoke: jest.fn(),
};

const serviceProvider = { provide: ApiKeysService, useValue: mockApiKeysService };

const moduleMetadata: ModuleMetadata = {
  controllers: [ApiKeysController],
  providers: [serviceProvider],
};

const guardOverride = { canActivate: () => true };

describe('ApiKeysController', () => {
  let controller: ApiKeysController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule(moduleMetadata)
      .overrideGuard(JwtAuthGuard)
      .useValue(guardOverride)
      .compile();
    controller = moduleRef.get<ApiKeysController>(ApiKeysController);
  });

  it('POST / returns one-time plaintext key in body', async () => {
    const expected: CreatedApiKey = {
      id: TEST_KEY_ID,
      label: 'Test',
      key: 'mk_abc123def456',
      keyPrefix: 'abcdefgh',
      createdAt: new Date(),
    };
    mockApiKeysService.createForUser.mockResolvedValue(expected);
    const result = await controller.create({ user: { id: TEST_USER_ID } } as unknown as AuthedReq, {
      label: 'Test',
    });
    expect(result).toHaveProperty('key');
    expect(result.key).toMatch(/^mk_/);
  });

  it('GET / returns sanitized list without key field', async () => {
    const summaries: ApiKeySummary[] = [
      {
        id: TEST_KEY_ID,
        label: 'Key 1',
        keyPrefix: 'abcdefgh',
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
      },
    ];
    mockApiKeysService.listForUser.mockResolvedValue(summaries);
    const result = await controller.list({ user: { id: TEST_USER_ID } } as unknown as AuthedReq);
    expect(result[0]).not.toHaveProperty('key');
    expect(result[0]).not.toHaveProperty('keyHash');
    expect(result[0]).toHaveProperty('keyPrefix');
  });

  it('DELETE /:id calls service.revoke with userId and keyId', async () => {
    mockApiKeysService.revoke.mockResolvedValue(undefined);
    await controller.revoke({ user: { id: TEST_USER_ID } } as unknown as AuthedReq, TEST_KEY_ID);
    expect(mockApiKeysService.revoke).toHaveBeenCalledWith(TEST_USER_ID, TEST_KEY_ID);
  });
});
