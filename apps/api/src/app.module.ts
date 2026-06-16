import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard, ThrottlerModuleOptions } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { RedisModule } from './redis/redis.module';
import { LinksModule } from './links/links.module';
import { RedirectModule } from './redirect/redirect.module';
import { ClickHouseModule } from './clickhouse/clickhouse.module';
import { StatsModule } from './stats/stats.module';
import { CleanupModule } from './cleanup/cleanup.module';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { McpModule } from './mcp/mcp.module';
import { UsageModule } from './usage/usage.module';

const DEFAULT_DB_PORT = 5432;

// Named throttle limits (in-memory, per-pod counters).
// Auth endpoints use the strict limit; redirect uses the generous one;
// everything else uses the liberal default to avoid breaking health checks.
const AUTH_THROTTLE_NAME = 'auth';
const REDIRECT_THROTTLE_NAME = 'redirect';

export { AUTH_THROTTLE_NAME, REDIRECT_THROTTLE_NAME };

function buildTypeOrmOptions(configService: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'postgres'),
    port: configService.get<number>('DB_PORT', DEFAULT_DB_PORT),
    username: configService.get<string>('DB_USER', 'postgres'),
    // Refuses to boot when DB_PASS is absent — a missing credential must
    // not silently fall back to a well-known default (design C3).
    password: configService.getOrThrow<string>('DB_PASS'),
    database: configService.get<string>('DB_NAME', 'mikrouli'),
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: false,
    logging: configService.get<string>('NODE_ENV') !== 'production',
    migrationsRun: configService.get<string>('MIGRATIONS_RUN', 'true') === 'true',
    migrationsTableName: 'typeorm_migrations',
  };
}

function buildThrottlerOptions(): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        // Default liberal limit — keeps health checks and static content from
        // tripping, while still bounding clearly abusive clients.
        name: 'default',
        ttl: 60_000,
        limit: 300,
      },
      {
        // Strict limit for auth endpoints (login / register / refresh).
        // 30 requests per minute per IP is protective against brute force while
        // allowing the Playwright e2e suite (which may issue up to ~20 auth calls
        // across all tests when run sequentially) to complete without tripping
        // the throttle.
        name: AUTH_THROTTLE_NAME,
        ttl: 60_000,
        limit: 30,
      },
      {
        // Generous limit for the redirect hot path — 120 per 10 s prevents
        // abuse while keeping the fast-path available under moderate load.
        name: REDIRECT_THROTTLE_NAME,
        ttl: 10_000,
        limit: 120,
      },
    ],
  };
}

const typeOrmModule = TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: buildTypeOrmOptions,
});

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: false }),
    typeOrmModule,
    ThrottlerModule.forRoot(buildThrottlerOptions()),
    ScheduleModule.forRoot(),
    HealthModule,
    UsersModule,
    AuthModule,
    ApiKeysModule,
    RedisModule,
    LinksModule,
    ClickHouseModule,
    StatsModule,
    RedirectModule,
    CleanupModule,
    McpModule,
    UsageModule,
  ],
  providers: [
    {
      // Apply the throttler globally; individual controllers opt into named
      // throttles via @Throttle({ <name>: { limit, ttl } }).
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
