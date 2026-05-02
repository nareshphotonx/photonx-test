import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { AppLogger } from '../../common/logger/app.logger';

@Injectable()
export class AiCacheService {
  private readonly logger = new AppLogger(AiCacheService.name);
  private readonly ttlSec: number;
  private readonly memory = new Map<string, { value: string; expiresAt: number }>();
  private readonly redis: Redis | null;

  constructor(private readonly configService: ConfigService) {
    this.ttlSec = Number(this.configService.get<string>('AI_CACHE_TTL_SEC', '600'));

    try {
      this.redis = new Redis({
        host: this.configService.get<string>('REDIS_HOST', 'localhost'),
        port: Number(this.configService.get<string>('REDIS_PORT', '6379')),
        password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
      });

      this.redis.on('error', (error) => {
        this.logger.warn(`Redis cache error: ${error.message}`);
      });
    } catch (error) {
      this.logger.warn(`Redis client unavailable; using memory cache fallback: ${String(error)}`);
      this.redis = null;
    }
  }

  buildCacheKey(input: {
    tenantId: string;
    userId: string;
    conversationId: string;
    prompt: string;
  }): string {
    const raw = [input.tenantId, input.userId, input.conversationId, input.prompt].join(':');
    const hash = createHash('sha256').update(raw).digest('hex');
    return `ai:chat:${input.tenantId}:${hash}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const fromMemory = this.memory.get(key);
    if (fromMemory && fromMemory.expiresAt > Date.now()) {
      return JSON.parse(fromMemory.value) as T;
    }

    if (this.redis) {
      try {
        await this.redis.connect();
      } catch {
        // already connected / fallback to memory if unavailable
      }

      try {
        const value = await this.redis.get(key);
        if (!value) {
          return null;
        }
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    }

    return null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const payload = JSON.stringify(value);
    this.memory.set(key, {
      value: payload,
      expiresAt: Date.now() + this.ttlSec * 1000,
    });

    if (this.redis) {
      try {
        await this.redis.connect();
      } catch {
        // ignore
      }

      try {
        await this.redis.set(key, payload, 'EX', this.ttlSec);
      } catch {
        // ignore, memory fallback still active
      }
    }
  }

  async invalidateTenant(tenantId: string): Promise<void> {
    const prefix = `ai:chat:${tenantId}:`;

    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) {
        this.memory.delete(key);
      }
    }

    if (!this.redis) {
      return;
    }

    try {
      await this.redis.connect();
    } catch {
      // ignore
    }

    try {
      const keys = await this.redis.keys(`${prefix}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {
      // ignore
    }
  }
}
