import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getHealth(): Promise<{
    status: string;
    uptime: number;
    timestamp: string;
    version: string;
    checks: {
      database: {
        status: 'up' | 'down';
        latencyMs: number;
        error?: string;
      };
      redis: {
        status: 'up' | 'down';
        latencyMs: number;
        error?: string;
      };
    };
  }> {
    const [databaseCheck, redisCheck] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const overallStatus =
      databaseCheck.status === 'up' && redisCheck.status === 'up'
        ? 'ok'
        : 'degraded';

    return {
      status: overallStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: this.configService.get<string>('APP_VERSION', '0.1.0'),
      checks: {
        database: databaseCheck,
        redis: redisCheck,
      },
    };
  }

  private async checkDatabase(): Promise<{
    status: 'up' | 'down';
    latencyMs: number;
    error?: string;
  }> {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return {
        status: 'up',
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        error:
          error instanceof Error
            ? error.message
            : 'Database connectivity check failed',
      };
    }
  }

  private async checkRedis(): Promise<{
    status: 'up' | 'down';
    latencyMs: number;
    error?: string;
  }> {
    const startedAt = Date.now();
    const client = new IORedis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: Number(this.configService.get<string>('REDIS_PORT', '6379')),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1500,
    });

    try {
      await client.connect();
      await client.ping();
      return {
        status: 'up',
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        error:
          error instanceof Error ? error.message : 'Redis connectivity check failed',
      };
    } finally {
      client.disconnect();
    }
  }
}
