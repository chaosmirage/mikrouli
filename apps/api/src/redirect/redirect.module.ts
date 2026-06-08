import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { LinksModule } from '../links/links.module';
import { StatsModule } from '../stats/stats.module';
import { RedirectController } from './redirect.controller';
import { RedirectService } from './redirect.service';

@Module({
  imports: [LinksModule, StatsModule, CacheModule],
  providers: [RedirectService],
  controllers: [RedirectController],
})
export class RedirectModule {}
