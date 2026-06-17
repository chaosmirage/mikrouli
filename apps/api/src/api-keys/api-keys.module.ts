import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ApiKey } from './api-key.entity';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { BearerOrApiKeyGuard } from './bearer-or-api-key.guard';
import { GuestOrAuthenticatedGuard } from './guest-or-authenticated.guard';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey]), UsersModule, AuthModule, UsageModule],
  providers: [ApiKeysService, ApiKeyAuthGuard, BearerOrApiKeyGuard, GuestOrAuthenticatedGuard],
  controllers: [ApiKeysController],
  exports: [
    BearerOrApiKeyGuard,
    ApiKeyAuthGuard,
    ApiKeysService,
    AuthModule,
    GuestOrAuthenticatedGuard,
  ],
})
export class ApiKeysModule {}
