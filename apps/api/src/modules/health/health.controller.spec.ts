import { Test, type TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return health payload', () => {
    const payload = controller.getHealth();

    expect(payload.status).toBe('ok');
    expect(typeof payload.uptime).toBe('number');
    expect(typeof payload.timestamp).toBe('string');
  });
});
