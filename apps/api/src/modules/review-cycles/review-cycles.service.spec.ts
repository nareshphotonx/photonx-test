import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ReviewCyclesService } from './review-cycles.service';

describe('ReviewCyclesService', () => {
  const prisma = {
    reviewCycle: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const auditService = { log: jest.fn() } as any;
  const service = new ReviewCyclesService(prisma, auditService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.reviewCycle.create.mockResolvedValue({
      id: 'cycle_1',
      tenantId: 'tenant_1',
      year: 2026,
      month: 5,
      status: 'OPEN',
      title: 'May 2026',
    });
  });

  it('enforces TEAM_LEAD or SUPER_ADMIN for cycle creation', async () => {
    const actor = {
      sub: 'user_1',
      tenantId: 'tenant_1',
      roles: ['USER'],
    } as Express.User;

    await expect(
      service.createReviewCycle('tenant_1', actor, {
        year: 2026,
        month: 5,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects duplicate monthly cycle per tenant', async () => {
    const actor = {
      sub: 'lead_1',
      tenantId: 'tenant_1',
      roles: ['TEAM_LEAD'],
    } as Express.User;

    prisma.reviewCycle.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.createReviewCycle('tenant_1', actor, {
        year: 2026,
        month: 5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates review cycle and writes audit log', async () => {
    const actor = {
      sub: 'lead_1',
      tenantId: 'tenant_1',
      roles: ['TEAM_LEAD'],
    } as Express.User;

    const result = await service.createReviewCycle('tenant_1', actor, {
      year: 2026,
      month: 5,
      title: 'May 2026 Performance Review',
    });

    expect(result.id).toBe('cycle_1');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REVIEW_CYCLE_CREATE',
        entityType: 'ReviewCycle',
        entityId: 'cycle_1',
      }),
    );
  });
});
