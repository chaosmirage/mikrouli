import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { BearerOrApiKeyGuard } from '../api-keys/bearer-or-api-key.guard';
import { GuestOrAuthenticatedGuard } from '../api-keys/guest-or-authenticated.guard';
import { LinkCacheService } from '../cache/link-cache.service';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { SkipThrottleWhenCredentialed } from '../common/credentialed-request-throttler.guard';
import {
  AUTH_THROTTLE_NAME,
  DEFAULT_THROTTLE_NAME,
  GUEST_CREATE_BUDGET,
  REDIRECT_THROTTLE_NAME,
} from '../common/throttler-policy';
import { CreateLinkDto } from './dto/create-link.dto';
import { UpdateLinkDto } from './dto/update-link.dto';
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
  // Guest-admissible creation skips the quota check and the SPA-origin check
  // is spoofable by any HTTP client, so this per-IP override is the ONLY abuse
  // bound on anonymous shortening — a deliberate bound, not an accident.
  @Throttle({ [DEFAULT_THROTTLE_NAME]: GUEST_CREATE_BUDGET })
  // That bound exists for the anonymous visitor alone: a credentialed request
  // is not a guest, so it sheds the three public names and runs under the
  // generous data budget exactly like the list/mutate routes below.
  @SkipThrottleWhenCredentialed({
    [DEFAULT_THROTTLE_NAME]: true,
    [AUTH_THROTTLE_NAME]: true,
    [REDIRECT_THROTTLE_NAME]: true,
  })
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

  // Authenticated list/mutate traffic runs under the generous data budget
  // alone: the skip sheds the three public names, whose floors would
  // otherwise bind through the min-rule.
  @SkipThrottle({
    [DEFAULT_THROTTLE_NAME]: true,
    [AUTH_THROTTLE_NAME]: true,
    [REDIRECT_THROTTLE_NAME]: true,
  })
  @Get()
  @UseGuards(BearerOrApiKeyGuard)
  async list(@Req() req: AuthenticatedRequest): Promise<LinksListResponse> {
    const links = await this.linksService.listForUser(req.user.id);
    return { data: links.map(toPublicLinkSchema) };
  }

  // Authenticated list/mutate traffic runs under the generous data budget
  // alone: the skip sheds the three public names, whose floors would
  // otherwise bind through the min-rule.
  @SkipThrottle({
    [DEFAULT_THROTTLE_NAME]: true,
    [AUTH_THROTTLE_NAME]: true,
    [REDIRECT_THROTTLE_NAME]: true,
  })
  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(BearerOrApiKeyGuard)
  async remove(@Req() req: AuthenticatedRequest, @Param('slug') slug: string): Promise<void> {
    await this.linksService.delete(slug, req.user.id);
    await this.linkCache.del(slug);
  }

  // Authenticated list/mutate traffic runs under the generous data budget
  // alone: the skip sheds the three public names, whose floors would
  // otherwise bind through the min-rule.
  @SkipThrottle({
    [DEFAULT_THROTTLE_NAME]: true,
    [AUTH_THROTTLE_NAME]: true,
    [REDIRECT_THROTTLE_NAME]: true,
  })
  @Patch(':slug')
  @UseGuards(BearerOrApiKeyGuard)
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body() dto: UpdateLinkDto,
  ): Promise<PublicLinkSchema> {
    const link = await this.linksService.updateDestination(slug, req.user.id, dto.url);
    // Write-through to the same key the redirect path reads, so the very next
    // request observes the new destination instead of the stale cached one.
    // An already-expired link is evicted rather than re-cached, matching what
    // delete does and what the redirect path's expiry treatment expects.
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
      await this.linkCache.del(slug);
    } else {
      await this.linkCache.set(link.shortUrl, link.originalUrl, link.expiresAt);
    }
    return toPublicLinkSchema(link);
  }
}
