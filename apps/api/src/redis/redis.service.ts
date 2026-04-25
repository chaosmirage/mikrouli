import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const DEFAULT_REDIS_HOST = 'redis-primary';
const DEFAULT_REDIS_PORT = 6379;

async function connectSafely(client: Redis, logger: Logger): Promise<void> {
  try {
    await client.connect();
  } catch (err) {
    logger.error('Failed to connect to Redis on startup', err);
  }
}

async function safeGet(client: Redis, key: string, logger: Logger): Promise<string | null> {
  try {
    return await client.get(key);
  } catch (err) {
    logger.error(`Redis GET failed for key "${key}"`, err);
    return null;
  }
}

async function setWithOptionalTtl(
  client: Redis,
  key: string,
  value: string,
  ttlSeconds?: number,
): Promise<void> {
  if (ttlSeconds !== undefined && ttlSeconds > 0) {
    await client.set(key, value, 'EX', ttlSeconds);
    return;
  }
  await client.set(key, value);
}

async function safeSet(
  client: Redis,
  key: string,
  value: string,
  ttlSeconds: number | undefined,
  logger: Logger,
): Promise<void> {
  try {
    await setWithOptionalTtl(client, key, value, ttlSeconds);
  } catch (err) {
    logger.error(`Redis SET failed for key "${key}"`, err);
  }
}

async function safeDel(client: Redis, key: string, logger: Logger): Promise<void> {
  try {
    await client.del(key);
  } catch (err) {
    logger.error(`Redis DEL failed for key "${key}"`, err);
  }
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST', DEFAULT_REDIS_HOST);
    const port = this.configService.get<number>('REDIS_PORT', DEFAULT_REDIS_PORT);
    this.client = new Redis({ host, port, lazyConnect: true });
    this.client.on('error', (err: Error) =>
      this.logger.error(`Redis error: ${err.message}`, err.stack),
    );
    this.client.on('connect', () => this.logger.log(`Connected to Redis at ${host}:${port}`));
    this.client.on('reconnecting', () => this.logger.warn('Redis reconnecting'));
  }

  async onModuleInit(): Promise<void> {
    await connectSafely(this.client, this.logger);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async get(key: string): Promise<string | null> {
    return safeGet(this.client, key, this.logger);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    return safeSet(this.client, key, value, ttlSeconds, this.logger);
  }

  async del(key: string): Promise<void> {
    return safeDel(this.client, key, this.logger);
  }
}
