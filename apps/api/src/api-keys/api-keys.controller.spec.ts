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

async function buildController(): Promise<ApiKeysController> {
  const moduleRef: TestingModule = await Test.createTestingModule(moduleMetadata)
    .overrideGuard(JwtAuthGuard)
    .useValue(guardOverride)
    .compile();
  return moduleRef.get<ApiKeysController>(ApiKeysController);
}

function makeCreatedApiKey(): CreatedApiKey {
  return {
    id: TEST_KEY_ID,
    label: 'Test',
    key: 'mk_abc123def456',
    keyPrefix: 'abcdefgh',
    createdAt: new Date(),
  };
}

function makeApiKeySummary(): ApiKeySummary {
  return {
    id: TEST_KEY_ID,
    label: 'Key 1',
    keyPrefix: 'abcdefgh',
    createdAt: new Date(),
    lastUsedAt: null,
    revokedAt: null,
  };
}

function makeAuthedReq(): AuthedReq {
  return { user: { id: TEST_USER_ID } } as unknown as AuthedReq;
}

describe('ApiKeysController', () => {
  let controller: ApiKeysController;

  beforeEach(async () => {
    jest.clearAllMocks();
    controller = await buildController();
  });

  it('POST / returns one-time plaintext key in body', async () => {
    mockApiKeysService.createForUser.mockResolvedValue(makeCreatedApiKey());
    const result = await controller.create(makeAuthedReq(), { label: 'Test' });
    expect(result).toHaveProperty('key');
    expect(result.key).toMatch(/^mk_/);
  });

  it('GET / returns wrapped { data } list without key field', async () => {
    mockApiKeysService.listForUser.mockResolvedValue([makeApiKeySummary()]);
    const result = await controller.list(makeAuthedReq());
    expect(result).toHaveProperty('data');
    expect(result.data[0]).not.toHaveProperty('key');
    expect(result.data[0]).not.toHaveProperty('keyHash');
    expect(result.data[0]).toHaveProperty('keyPrefix');
  });

  it('DELETE /:id calls service.revoke with userId and keyId', async () => {
    mockApiKeysService.revoke.mockResolvedValue(undefined);
    await controller.revoke(makeAuthedReq(), TEST_KEY_ID);
    expect(mockApiKeysService.revoke).toHaveBeenCalledWith(TEST_USER_ID, TEST_KEY_ID);
  });
});
