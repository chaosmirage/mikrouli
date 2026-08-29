import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { StatsService } from '../stats/stats.service';
import { RedirectService, RedirectResolution } from './redirect.service';
import {
  AUTH_THROTTLE_NAME,
  DATA_THROTTLE_NAME,
  DEFAULT_THROTTLE_NAME,
  REDIRECT_HOT_PATH_BUDGET,
  REDIRECT_THROTTLE_NAME,
} from '../common/throttler-policy';

const REDIRECT_STATUS = HttpStatus.FOUND; // 302
const SLUG_LENGTH = 6;

class GoneException extends HttpException {
  constructor(message = 'link expired') {
    super({ statusCode: HttpStatus.GONE, message }, HttpStatus.GONE);
  }
}

function rejectInvalidSlug(slug: string): void {
  if (slug.length !== SLUG_LENGTH) throw new NotFoundException(`unknown slug ${slug}`);
}

function extractUa(req: Request): string | undefined {
  const ua = req.headers['user-agent'];
  return Array.isArray(ua) ? ua[0] : ua;
}

function recordStatsIfActive(
  stats: StatsService,
  resolution: RedirectResolution,
  slug: string,
  req: Request,
): void {
  if (resolution.status !== 'active') return;
  void stats.record(slug, req.ip, extractUa(req));
}

function applyRedirect(res: Response, resolution: RedirectResolution): void {
  if (resolution.status === 'active' && resolution.originalUrl) {
    res.redirect(REDIRECT_STATUS, resolution.originalUrl);
    return;
  }
  if (resolution.status === 'expired') throw new GoneException();
  throw new NotFoundException('unknown slug');
}

@Controller(':slug')
export class RedirectController {
  constructor(
    private readonly redirectService: RedirectService,
    private readonly statsService: StatsService,
  ) {}

  @Get()
  // The hot path runs on the redirect budget alone: the min-rule over all
  // non-skipped names would otherwise cap it at the stricter 300/60s default
  // floor, below this route's designed 120 req / 10 s. The override pins the
  // budget; the skip sheds every other declared name.
  @Throttle({ [REDIRECT_THROTTLE_NAME]: REDIRECT_HOT_PATH_BUDGET })
  @SkipThrottle({
    [DEFAULT_THROTTLE_NAME]: true,
    [AUTH_THROTTLE_NAME]: true,
    [DATA_THROTTLE_NAME]: true,
  })
  async redirect(
    @Param('slug') slug: string,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    rejectInvalidSlug(slug);
    const resolution = await this.redirectService.resolve(slug);
    recordStatsIfActive(this.statsService, resolution, slug, req);
    applyRedirect(res, resolution);
  }
}
