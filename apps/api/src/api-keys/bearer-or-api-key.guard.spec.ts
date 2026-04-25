import { ModuleMetadata, UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { BearerOrApiKeyGuard } from './bearer-or-api-key.guard';

function buildMockContext(headers: Record<string, string>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ headers }) }) } as unknown as ExecutionContext;
}

const mockJwtGuard = { canActivate: jest.fn() };
const mockApiKeyGuard = { canActivate: jest.fn() };

const jwtProvider = { provide: JwtAuthGuard, useValue: mockJwtGuard };
const apiKeyProvider = { provide: ApiKeyAuthGuard, useValue: mockApiKeyGuard };

const moduleMetadata: ModuleMetadata = {
  providers: [BearerOrApiKeyGuard, jwtProvider, apiKeyProvider],
};

describe('BearerOrApiKeyGuard', () => {
  let guard: BearerOrApiKeyGuard;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockJwtGuard.canActivate.mockResolvedValue(true);
    mockApiKeyGuard.canActivate.mockResolvedValue(true);
    const moduleRef: TestingModule = await Test.createTestingModule(moduleMetadata).compile();
    guard = moduleRef.get<BearerOrApiKeyGuard>(BearerOrApiKeyGuard);
  });

  it('delegates to JwtAuthGuard when Authorization Bearer header present', async () => {
    const context = buildMockContext({ authorization: 'Bearer sometoken' });
    await guard.canActivate(context);
    expect(mockJwtGuard.canActivate).toHaveBeenCalledWith(context);
    expect(mockApiKeyGuard.canActivate).not.toHaveBeenCalled();
  });

  it('delegates to ApiKeyAuthGuard when X-API-Key header present', async () => {
    const context = buildMockContext({ 'x-api-key': 'mk_somekey' });
    await guard.canActivate(context);
    expect(mockApiKeyGuard.canActivate).toHaveBeenCalledWith(context);
    expect(mockJwtGuard.canActivate).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when neither header present', async () => {
    const context = buildMockContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
