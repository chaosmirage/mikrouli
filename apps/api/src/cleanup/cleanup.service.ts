import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { DataSource, LessThan } from 'typeorm';
import { LinkCacheService } from '../cache/link-cache.service';
import { Link } from '../links/entities/link.entity';

const CLEANUP_BATCH_SIZE = 1_000;
const CLEANUP_CRON = '0 * * * *';

async function findExpiredLinks(ds: DataSource, now: Date): Promise<Link[]> {
  return ds.manager.find(Link, {
    where: { expiresAt: LessThan(now) },
    take: CLEANUP_BATCH_SIZE,
    select: ['shortUrl', 'originalUrl', 'expiresAt'],
  });
}

async function removeFromDbAndCache(
  ds: DataSource,
  linkCache: LinkCacheService,
  slug: string,
): Promise<void> {
  await ds.manager.delete(Link, { shortUrl: slug });
  await linkCache.del(slug);
}

async function deleteOneSafely(
  ds: DataSource,
  linkCache: LinkCacheService,
  link: Link,
  logger: Logger,
): Promise<boolean> {
  try {
    await removeFromDbAndCache(ds, linkCache, link.shortUrl);
    return true;
  } catch (err) {
    logger.error(`cleanup failed for slug ${link.shortUrl}: ${(err as Error).message}`);
    return false;
  }
}

async function processBatch(
  ds: DataSource,
  linkCache: LinkCacheService,
  expired: Link[],
  logger: Logger,
): Promise<number> {
  let count = 0;
  for (const link of expired) {
    const ok = await deleteOneSafely(ds, linkCache, link, logger);
    if (ok) count++;
  }
  return count;
}

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly linkCache: LinkCacheService,
  ) {}

  @Cron(CLEANUP_CRON)
  async handleCleanup(): Promise<number> {
    const expired = await findExpiredLinks(this.dataSource, new Date());
    if (expired.length === 0) return 0;
    return processBatch(this.dataSource, this.linkCache, expired, this.logger);
  }
}
