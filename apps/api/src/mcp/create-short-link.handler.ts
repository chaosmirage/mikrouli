/**
 * MCP tool handler for create_short_link.
 *
 * Guarantees: validates the input with the SAME CreateLinkDto the REST
 * controller uses (including IsPublicHttpUrl SSRF guard), then calls
 * LinksService.create in-process. Result is shaped identically to PublicLink
 * so callers who know the REST contract need no new vocabulary.
 *
 * The handler re-validates via plainToInstance + class-validator because
 * calling LinksService directly bypasses the global ValidationPipe seam
 * (design section 2.3, tech-decisions 3.5).
 */

import { HttpException, UnprocessableEntityException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { CreateLinkDto } from '../links/dto/create-link.dto';
import type { LinksService } from '../links/links.service';
import type { Link } from '../links/entities/link.entity';
import { mapHttpExceptionToToolError } from './mcp-error-mapper';

interface CreateShortLinkInput {
  url: string;
  expiresAt?: string;
}

interface PublicLinkResult {
  shortUrl: string;
  originalUrl: string;
  createdAt: string;
  expiresAt: string | null;
}

interface StructuredResult extends PublicLinkResult {
  /** Full usable link: baseUrl + "/" + shortUrl (the slug). */
  shortLink: string;
}

function toPublicLinkResult(link: Link): PublicLinkResult {
  return {
    shortUrl: link.shortUrl,
    originalUrl: link.originalUrl,
    createdAt: link.createdAt.toISOString(),
    expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
  };
}

/**
 * Validates the input against CreateLinkDto (same rules as REST) and throws
 * a 422 UnprocessableEntityException if validation fails, so the error path
 * stays consistent whether the call originated from REST or MCP.
 */
async function validateInput(args: CreateShortLinkInput): Promise<CreateLinkDto> {
  const dto = plainToInstance(CreateLinkDto, args);
  const errors = await validate(dto);
  if (errors.length > 0) {
    throw new UnprocessableEntityException({
      kind: 'validation',
      errors: errors.map((e) => ({
        property: e.property,
        constraints: e.constraints ?? {},
      })),
    });
  }
  return dto;
}

/**
 * Returns a stateless per-request tool handler bound to the authenticated
 * caller's userId and the configured public base URL.
 *
 * Creates a new handler function each request so no credential is retained
 * across calls (design 2.5, tech-decisions 3.4).
 *
 * @param linksService - service for creating links
 * @param userId - authenticated caller's user ID
 * @param baseUrl - public base URL (e.g. "https://mikrou.li"), trailing slash stripped
 */
export function createShortLinkHandler(
  linksService: Pick<LinksService, 'create'>,
  userId: string,
  baseUrl: string,
): (args: CreateShortLinkInput) => Promise<CallToolResult> {
  const base = baseUrl.replace(/\/$/, '');

  return async (args: CreateShortLinkInput): Promise<CallToolResult> => {
    let dto: CreateLinkDto;
    try {
      dto = await validateInput(args);
    } catch (err) {
      if (err instanceof HttpException) {
        return mapHttpExceptionToToolError(err);
      }
      throw err;
    }

    let link: Link;
    try {
      link = await linksService.create(dto.url, userId, dto.expiresAt);
    } catch (err) {
      if (err instanceof HttpException) {
        return mapHttpExceptionToToolError(err);
      }
      throw err;
    }

    const result = toPublicLinkResult(link);
    const shortLink = `${base}/${result.shortUrl}`;
    const structured: StructuredResult = { ...result, shortLink };

    return {
      content: [{ type: 'text', text: shortLink }],
      structuredContent: structured as unknown as Record<string, unknown>,
    };
  };
}
