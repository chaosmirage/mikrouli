import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { BearerOrApiKeyGuard } from '../api-keys/bearer-or-api-key.guard';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import {
  AUTH_THROTTLE_NAME,
  DEFAULT_THROTTLE_NAME,
  REDIRECT_THROTTLE_NAME,
} from '../common/throttler-policy';
import { LinksService } from '../links/links.service';
import { AggregatedStats, StatsService } from './stats.service';
import type { StatsAggregateResponse } from '../types/openapi';

function toStatsResponse(slug: string, stats: AggregatedStats): StatsAggregateResponse {
  return {
    slug,
    totalClicks: stats.totalClicks,
    byDay: stats.clicksByDay.map((r) => ({ period: r.date, clicks: r.clicks })),
    byCountry: stats.topCountries.map((r) => ({ country: r.name, clicks: r.clicks })),
    byBrowser: stats.topBrowsers.map((r) => ({ browser: r.name, clicks: r.clicks })),
  };
}

async function verifyLinkOwnership(
  linksService: LinksService,
  slug: string,
  userId: string,
): Promise<void> {
  const link = await linksService.findBySlug(slug);
  if (!link) throw new NotFoundException(`Link ${slug} not found`);
  if (link.userId !== userId) throw new ForbiddenException();
}

@Controller('stats')
@UseGuards(BearerOrApiKeyGuard)
// Authenticated traffic runs under the generous data budget alone: the skip
// sheds the three public names, whose floors would otherwise bind through
// the min-rule. Auth remains the primary control on these routes.
@SkipThrottle({
  [DEFAULT_THROTTLE_NAME]: true,
  [AUTH_THROTTLE_NAME]: true,
  [REDIRECT_THROTTLE_NAME]: true,
})
export class StatsController {
  constructor(
    private readonly statsService: StatsService,
    private readonly linksService: LinksService,
  ) {}

  @Get(':slug')
  async getStats(
    @Param('slug') slug: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<StatsAggregateResponse> {
    await verifyLinkOwnership(this.linksService, slug, req.user.id);
    const stats = await this.statsService.getStats(slug);
    return toStatsResponse(slug, stats);
  }
}
