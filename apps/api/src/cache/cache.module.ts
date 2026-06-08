import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { LinkCacheService } from './link-cache.service';

@Module({
  imports: [RedisModule],
  providers: [LinkCacheService],
  exports: [LinkCacheService],
})
export class CacheModule {}
