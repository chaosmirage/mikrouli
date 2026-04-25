import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { BearerOrApiKeyGuard } from '../api-keys/bearer-or-api-key.guard';
import { LinksService } from '../links/links.service';
import { AggregatedStats, StatsService } from './stats.service';

interface AuthenticatedRequest extends Request {
  user: { id: string };
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
export class StatsController {
  constructor(
    private readonly statsService: StatsService,
    private readonly linksService: LinksService,
  ) {}

  @Get(':slug')
  async getStats(
    @Param('slug') slug: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AggregatedStats> {
    await verifyLinkOwnership(this.linksService, slug, req.user.id);
    return this.statsService.getStats(slug);
  }
}
