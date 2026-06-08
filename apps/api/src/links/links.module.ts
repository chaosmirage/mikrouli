import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { CacheModule } from '../cache/cache.module';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';
import { SlugGeneratorService } from './slug-generator.service';

@Module({
  imports: [ApiKeysModule, CacheModule],
  providers: [LinksService, SlugGeneratorService],
  controllers: [LinksController],
  exports: [LinksService],
})
export class LinksModule {}
