import { Injectable } from '@nestjs/common';
import { LinkCacheService } from '../cache/link-cache.service';
import { LinksService } from '../links/links.service';
import type { Link } from '../links/entities/link.entity';

export type RedirectStatus = 'active' | 'expired' | 'not-found';

export interface RedirectResolution {
  status: RedirectStatus;
  originalUrl?: string;
}

function isExpired(link: Pick<Link, 'expiresAt'>): boolean {
  if (link.expiresAt === null) return false;
  return link.expiresAt.getTime() <= Date.now();
}

@Injectable()
export class RedirectService {
  constructor(
    private readonly linksService: LinksService,
    private readonly linkCache: LinkCacheService,
  ) {}

  private async resolveFromDatabase(slug: string): Promise<RedirectResolution> {
    const link = await this.linksService.findBySlug(slug);
    if (link === null) return { status: 'not-found' };
    if (isExpired(link)) return { status: 'expired' };
    await this.linkCache.set(slug, link.originalUrl, link.expiresAt);
    return { status: 'active', originalUrl: link.originalUrl };
  }

  async resolve(slug: string): Promise<RedirectResolution> {
    const cached = await this.linkCache.get(slug);
    if (cached !== null) return { status: 'active', originalUrl: cached };
    return this.resolveFromDatabase(slug);
  }
}
