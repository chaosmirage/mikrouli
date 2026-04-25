import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';
import { SlugGeneratorService } from './slug-generator.service';

@Module({
  imports: [ApiKeysModule],
  providers: [LinksService, SlugGeneratorService],
  controllers: [LinksController],
})
export class LinksModule {}
