import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Service health check' })
  @ApiOkResponse({
    description: 'Service is healthy',
    example: {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        status: 'ok',
        uptime: 1024.65,
        timestamp: '2026-05-02T12:00:00.000Z',
        version: '0.1.0',
        checks: {
          database: {
            status: 'up',
            latencyMs: 4,
          },
          redis: {
            status: 'up',
            latencyMs: 2,
          },
        },
      },
    },
  })
  getHealth(): Promise<{
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
    return this.healthService.getHealth();
  }
}
