import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class AiRedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiRedisService.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (attempt: number) => attempt > 2 ? null : 200,
    });
    this.redis.on('error', () => undefined);
  }

  async onModuleInit() {
    try {
      await this.redis.connect();
      this.logger.log('Redis cache connected');
    } catch {
      this.logger.warn('Redis is unavailable; AI APIs will continue without cache');
    }
  }

  async onModuleDestroy() {
    if (this.redis.status === 'ready') await this.redis.quit();
    else this.redis.disconnect();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) as T : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // PostgreSQL remains the source of truth when Redis is unavailable.
    }
  }

  async delete(key: string): Promise<void> {
    try { await this.redis.del(key); } catch { /* Cache cleanup is best effort. */ }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = next;
        if (keys.length) await this.redis.del(...keys);
      } while (cursor !== '0');
    } catch {
      // Expiring keys will be removed by Redis if a cleanup scan cannot run.
    }
  }
}
