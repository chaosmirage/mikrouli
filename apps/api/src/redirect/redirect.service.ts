import { Injectable } from '@nestjs/common';
import { LinksService } from '../links/links.service';
import { RedisService } from '../redis/redis.service';
import type { Link } from '../links/entities/link.entity';

const CACHE_PREFIX = 'link:';
const CACHE_TTL_CAP_SECONDS = 86_400;

export type RedirectStatus = 'active' | 'expired' | 'not-found';

export interface RedirectResolution {
  status: RedirectStatus;
  originalUrl?: string;
}

function isExpired(link: Pick<Link, 'expiresAt'>): boolean {
  if (link.expiresAt === null) return false;
  return link.expiresAt.getTime() <= Date.now();
}

function ttlSecondsUntil(expiresAt: Date | null): number | undefined {
  if (expiresAt === null) return CACHE_TTL_CAP_SECONDS;
  const diffMs = expiresAt.getTime() - Date.now();
  if (diffMs <= 0) return undefined;
  return Math.min(Math.floor(diffMs / 1000), CACHE_TTL_CAP_SECONDS);
}

@Injectable()
export class RedirectService {
  constructor(
    private readonly linksService: LinksService,
    private readonly redisService: RedisService,
  ) {}

  private cacheKey(slug: string): string {
    return `${CACHE_PREFIX}${slug}`;
  }

  private async tryCache(slug: string): Promise<string | null> {
    return this.redisService.get(this.cacheKey(slug));
  }

  private async backfillCache(slug: string, link: Link): Promise<void> {
    await this.redisService.set(this.cacheKey(slug), link.originalUrl, ttlSecondsUntil(link.expiresAt));
  }

  private async resolveFromDatabase(slug: string): Promise<RedirectResolution> {
    const link = await this.linksService.findBySlug(slug);
    if (link === null) return { status: 'not-found' };
    if (isExpired(link)) return { status: 'expired' };
    await this.backfillCache(slug, link);
    return { status: 'active', originalUrl: link.originalUrl };
  }

  async resolve(slug: string): Promise<RedirectResolution> {
    const cached = await this.tryCache(slug);
    if (cached !== null) return { status: 'active', originalUrl: cached };
    return this.resolveFromDatabase(slug);
  }
}
