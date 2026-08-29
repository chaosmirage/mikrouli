import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { buildThrottlerOptions } from './common/throttler-policy';
import { McpModule } from './mcp/mcp.module';
import { UsageModule } from './usage/usage.module';

const DEFAULT_DB_PORT = 5432;

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
      // Apply the throttler policy (common/throttler-policy.ts) globally;
      // controllers select or shed named budgets per route via
      // @Throttle({ <name>: { limit, ttl } }) / @SkipThrottle({ <name>: true }).
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
