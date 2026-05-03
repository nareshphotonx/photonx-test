import { Test, type TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  const healthServiceMock = {
    getHealth: jest.fn().mockResolvedValue({
      status: 'ok',
      uptime: 123,
      timestamp: '2026-05-02T00:00:00.000Z',
      version: '0.1.0',
      checks: {
        database: { status: 'up', latencyMs: 10 },
        redis: { status: 'up', latencyMs: 12 },
      },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: healthServiceMock,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return health payload', async () => {
    const payload = await controller.getHealth();

    expect(payload.status).toBe('ok');
    expect(typeof payload.uptime).toBe('number');
    expect(typeof payload.timestamp).toBe('string');
  });
});
