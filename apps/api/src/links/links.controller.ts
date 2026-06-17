import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BearerOrApiKeyGuard } from '../api-keys/bearer-or-api-key.guard';
import { GuestOrAuthenticatedGuard } from '../api-keys/guest-or-authenticated.guard';
import { LinkCacheService } from '../cache/link-cache.service';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { CreateLinkDto } from './dto/create-link.dto';
import { Link } from './entities/link.entity';
import { LinksService } from './links.service';
import type { CreateLinkResponse, LinksListResponse, PublicLinkSchema } from '../types/openapi';

function toPublicLinkSchema(link: Link): PublicLinkSchema {
  return {
    shortUrl: link.shortUrl,
    originalUrl: link.originalUrl,
    createdAt: link.createdAt.toISOString(),
    expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
  };
}

// Per-method guards: list/remove stay BearerOrApiKeyGuard (registered users
// only); create is widened to GuestOrAuthenticatedGuard so an anonymous
// visitor can shorten when GUEST_SHORTEN_ENABLED=true. The class-level
// @UseGuards was dropped so each method declares its own admission policy.
@Controller('urls')
export class LinksController {
  constructor(
    private readonly linksService: LinksService,
    private readonly linkCache: LinkCacheService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(GuestOrAuthenticatedGuard)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateLinkDto,
  ): Promise<CreateLinkResponse> {
    // The guard sets isGuest on req.user; the controller branches here so the
    // service stays actor-agnostic except for the quota-skip path.
    const link = req.user.isGuest
      ? await this.linksService.createGuest(dto.url, req.user.id, dto.expiresAt)
      : await this.linksService.create(dto.url, req.user.id, dto.expiresAt);
    await this.linkCache.set(link.shortUrl, link.originalUrl, link.expiresAt);
    return toPublicLinkSchema(link);
  }

  @Get()
  @UseGuards(BearerOrApiKeyGuard)
  async list(@Req() req: AuthenticatedRequest): Promise<LinksListResponse> {
    const links = await this.linksService.listForUser(req.user.id);
    return { data: links.map(toPublicLinkSchema) };
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(BearerOrApiKeyGuard)
  async remove(@Req() req: AuthenticatedRequest, @Param('slug') slug: string): Promise<void> {
    await this.linksService.delete(slug, req.user.id);
    await this.linkCache.del(slug);
  }
}
