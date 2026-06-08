import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { CleanupService } from './cleanup.service';

@Module({
  imports: [CacheModule],
  providers: [CleanupService],
  exports: [CleanupService],
})
export class CleanupModule {}
