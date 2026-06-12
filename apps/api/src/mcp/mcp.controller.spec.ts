/**
 * Verifies the MCP controller auth boundary:
 *   - missing x-api-key -> 401 before the JSON-RPC layer is entered
 *   - invalid x-api-key -> 401 before the JSON-RPC layer is entered
 *   - GET /api/mcp -> 405
 *   - DELETE /api/mcp -> 405
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ApiKeyAuthGuard } from '../api-keys/api-key-auth.guard';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { LinksService } from '../links/links.service';
import { ConfigModule } from '@nestjs/config';
import { ProblemDetailsFilter } from '../common/problem-details.filter';
import { ConfigService } from '@nestjs/config';
import { McpController } from './mcp.controller';
import { PUBLIC_BASE_URL_TOKEN } from './mcp.constants';

// Minimal valid MCP JSON-RPC initialize payload
const MCP_INIT_PAYLOAD = {
  jsonrpc: '2.0',
  method: 'initialize',
  id: 1,
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '1' },
  },
};

function makeApiKeysServiceMock(options: { validKey?: string } = {}) {
  return {
    validate: jest.fn().mockImplementation(async (key: string) => {
      if (options.validKey && key === options.validKey) {
        return { userId: 'user-id-1' };
      }
      return null;
    }),
  };
}

describe('McpController auth boundary', () => {
  let app: INestApplication;
  const apiKeysServiceMock = makeApiKeysServiceMock({ validKey: 'mk_valid_key' });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      ],
      providers: [
        McpController,
        ApiKeyAuthGuard,
        {
          provide: ApiKeysService,
          useValue: apiKeysServiceMock,
        },
        {
          provide: LinksService,
          // shortUrl is the bare 6-char slug, not a full URL
          useValue: {
            create: jest.fn().mockResolvedValue({
              shortUrl: 'abcdef',
              originalUrl: 'https://example.com',
              createdAt: new Date(),
              expiresAt: new Date(),
            }),
          },
        },
        {
          provide: PUBLIC_BASE_URL_TOKEN,
          useValue: 'https://mikrou.li',
        },
      ],
      controllers: [McpController],
    }).compile();

    app = module.createNestApplication();
    const configService = app.get(ConfigService);
    app.useGlobalFilters(new ProblemDetailsFilter(configService));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/mcp without x-api-key returns 401 application/problem+json', async () => {
    const res = await request(app.getHttpServer())
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .send(MCP_INIT_PAYLOAD);

    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({ status: 401 });
  });

  it('POST /api/mcp with invalid x-api-key returns 401 application/problem+json', async () => {
    const res = await request(app.getHttpServer())
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('x-api-key', 'mk_invalid_key')
      .send(MCP_INIT_PAYLOAD);

    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
  });

  it('GET /api/mcp returns 405', async () => {
    const res = await request(app.getHttpServer())
      .get('/mcp')
      .set('x-api-key', 'mk_valid_key');

    expect(res.status).toBe(405);
  });

  it('DELETE /api/mcp returns 405', async () => {
    const res = await request(app.getHttpServer())
      .delete('/mcp')
      .set('x-api-key', 'mk_valid_key');

    expect(res.status).toBe(405);
  });
});
