import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const CACHE_PREFIX = 'link:';
const CACHE_TTL_CAP_SECONDS = 86_400;

@Injectable()
export class LinkCacheService {
  constructor(private readonly redisService: RedisService) {}

  private cacheKey(slug: string): string {
    return `${CACHE_PREFIX}${slug}`;
  }

  private ttlSecondsUntil(expiresAt: Date | null): number | undefined {
    if (expiresAt === null) return CACHE_TTL_CAP_SECONDS;
    const diffMs = expiresAt.getTime() - Date.now();
    if (diffMs <= 0) return undefined;
    return Math.min(Math.floor(diffMs / 1000), CACHE_TTL_CAP_SECONDS);
  }

  async get(slug: string): Promise<string | null> {
    return this.redisService.get(this.cacheKey(slug));
  }

  async set(slug: string, originalUrl: string, expiresAt: Date | null): Promise<void> {
    await this.redisService.set(this.cacheKey(slug), originalUrl, this.ttlSecondsUntil(expiresAt));
  }

  async del(slug: string): Promise<void> {
    await this.redisService.del(this.cacheKey(slug));
  }
}
