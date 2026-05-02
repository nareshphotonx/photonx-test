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
  })
  getHealth(): { status: string; uptime: number; timestamp: string } {
    return this.healthService.getHealth();
  }
}
