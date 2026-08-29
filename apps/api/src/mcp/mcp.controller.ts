/**
 * MCP controller -- mounts the MCP Streamable HTTP server at POST /api/mcp.
 *
 * Auth: ApiKeyAuthGuard (x-api-key header only). Cookie auth is deliberately
 * excluded: a cookie-authenticated JSON-RPC POST endpoint is a CSRF-shaped
 * risk (design 2.5, tech-decisions 3.4, api_contract section 3.1).
 *
 * Lifecycle: a fresh McpServer + StreamableHTTPServerTransport per POST so no
 * credential or state is retained across requests (stateless, horizontally
 * scalable per the existing HPA -- design 2.5).
 *
 * GET and DELETE return 405 -- the endpoint accepts only POST.
 */

import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  MethodNotAllowedException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { ApiKeyAuthGuard } from '../api-keys/api-key-auth.guard';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import {
  AUTH_THROTTLE_NAME,
  DEFAULT_THROTTLE_NAME,
  REDIRECT_THROTTLE_NAME,
} from '../common/throttler-policy';
import { LinksService } from '../links/links.service';
import { createShortLinkHandler } from './create-short-link.handler';
import { PUBLIC_BASE_URL_TOKEN } from './mcp.constants';

const MCP_SERVER_NAME = 'mikrouli';
const MCP_SERVER_VERSION = '1.0.0';

const TOOL_CREATE_SHORT_LINK = 'create_short_link';
const TOOL_DESCRIPTION =
  'Create a short link. Provide a public http(s) URL; optionally an ISO 8601 expiresAt. ' +
  'Returns the full usable link as text and PublicLink metadata in structuredContent.';

const createShortLinkSchema = z.object({
  url: z
    .string()
    .describe(
      'The target URL to shorten. Must be a public http(s) URL (no localhost or private-IP ranges). Max 8192 characters.',
    ),
  expiresAt: z
    .string()
    .optional()
    .describe('Optional expiry timestamp in ISO 8601 UTC format. Defaults to +3 years if omitted.'),
});

@Controller('mcp')
// API-key-authenticated traffic runs under the generous data budget alone:
// the skip sheds the three public names, whose floors would otherwise bind
// through the min-rule. The API key check remains the primary control.
@SkipThrottle({
  [DEFAULT_THROTTLE_NAME]: true,
  [AUTH_THROTTLE_NAME]: true,
  [REDIRECT_THROTTLE_NAME]: true,
})
export class McpController {
  constructor(
    private readonly linksService: LinksService,
    @Inject(PUBLIC_BASE_URL_TOKEN) private readonly baseUrl: string,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyAuthGuard)
  async handleMcp(
    @Req() req: Request & Partial<AuthenticatedRequest>,
    @Res() res: Response,
  ): Promise<void> {
    const userId = (req as AuthenticatedRequest).user.id;

    const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    const toolHandler = createShortLinkHandler(this.linksService, userId, this.baseUrl);

    server.registerTool(
      TOOL_CREATE_SHORT_LINK,
      {
        description: TOOL_DESCRIPTION,
        inputSchema: createShortLinkSchema,
      },
      toolHandler,
    );

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body as unknown);

    res.on('close', () => {
      void transport.close();
      void server.close();
    });
  }

  @Get()
  handleGet(): never {
    throw new MethodNotAllowedException('Only POST is supported on /api/mcp');
  }

  @Delete()
  handleDelete(): never {
    throw new MethodNotAllowedException('Only POST is supported on /api/mcp');
  }
}
