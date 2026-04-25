import { Module } from '@nestjs/common';
import { LinksModule } from '../links/links.module';
import { StatsModule } from '../stats/stats.module';
import { RedirectController } from './redirect.controller';
import { RedirectService } from './redirect.service';

@Module({
  imports: [LinksModule, StatsModule],
  providers: [RedirectService],
  controllers: [RedirectController],
})
export class RedirectModule {}
