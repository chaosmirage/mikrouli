import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ApiKeysModule } from './api-keys/api-keys.module';

const DEFAULT_DB_PORT = 5432;

function buildTypeOrmOptions(configService: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'postgres'),
    port: configService.get<number>('DB_PORT', DEFAULT_DB_PORT),
    username: configService.get<string>('DB_USER', 'postgres'),
    password: configService.get<string>('DB_PASS', 'postgres'),
    database: configService.get<string>('DB_NAME', 'mikrouli'),
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: false,
    logging: configService.get<string>('NODE_ENV') !== 'production',
    migrationsRun: true,
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
    ScheduleModule.forRoot(),
    HealthModule,
    UsersModule,
    AuthModule,
    ApiKeysModule,
  ],
})
export class AppModule {}
