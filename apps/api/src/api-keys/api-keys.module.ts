import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ApiKey } from './api-key.entity';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { BearerOrApiKeyGuard } from './bearer-or-api-key.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey]), UsersModule, AuthModule],
  providers: [ApiKeysService, ApiKeyAuthGuard, BearerOrApiKeyGuard],
  controllers: [ApiKeysController],
  exports: [BearerOrApiKeyGuard, ApiKeyAuthGuard, ApiKeysService, AuthModule],
})
export class ApiKeysModule {}
