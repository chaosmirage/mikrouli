import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { DataSource, LessThan } from 'typeorm';
import { Link } from '../links/entities/link.entity';
import { RedisService } from '../redis/redis.service';

const CLEANUP_BATCH_SIZE = 1_000;
const CLEANUP_CRON = '0 * * * *';
const REDIS_KEY_PREFIX = 'link:';

async function findExpiredLinks(ds: DataSource, now: Date): Promise<Link[]> {
  return ds.manager.find(Link, {
    where: { expiresAt: LessThan(now) },
    take: CLEANUP_BATCH_SIZE,
    select: ['shortUrl', 'originalUrl', 'expiresAt'],
  });
}

async function removeFromDbAndCache(
  ds: DataSource,
  redis: RedisService,
  slug: string,
): Promise<void> {
  await ds.manager.delete(Link, { shortUrl: slug });
  await redis.del(`${REDIS_KEY_PREFIX}${slug.trim()}`);
}

async function deleteOneSafely(
  ds: DataSource,
  redis: RedisService,
  link: Link,
  logger: Logger,
): Promise<boolean> {
  try {
    await removeFromDbAndCache(ds, redis, link.shortUrl);
    return true;
  } catch (err) {
    logger.error(`cleanup failed for slug ${link.shortUrl}: ${(err as Error).message}`);
    return false;
  }
}

async function processBatch(
  ds: DataSource,
  redis: RedisService,
  expired: Link[],
  logger: Logger,
): Promise<number> {
  let count = 0;
  for (const link of expired) {
    const ok = await deleteOneSafely(ds, redis, link, logger);
    if (ok) count++;
  }
  return count;
}

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  @Cron(CLEANUP_CRON)
  async handleCleanup(): Promise<number> {
    const expired = await findExpiredLinks(this.dataSource, new Date());
    if (expired.length === 0) return 0;
    return processBatch(this.dataSource, this.redisService, expired, this.logger);
  }
}
