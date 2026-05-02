import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ReviewEntriesService } from './review-entries.service';

describe('ReviewEntriesService', () => {
  const prisma = {
    reviewCycle: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
    teamMember: { findFirst: jest.fn() },
    reviewEntry: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const scopeService = {
    getLeadTeamIds: jest.fn(),
  } as any;

  const auditService = { log: jest.fn() } as any;

  const service = new ReviewEntriesService(prisma, scopeService, auditService);

  const teamLeadActor = {
    sub: 'lead_1',
    tenantId: 'tenant_1',
    roles: ['TEAM_LEAD'],
  } as Express.User;

  const superAdminActor = {
    sub: 'admin_1',
    tenantId: 'tenant_1',
    roles: ['SUPER_ADMIN'],
  } as Express.User;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.reviewCycle.findFirst.mockResolvedValue({ id: 'cycle_1', status: 'OPEN' });
    prisma.user.findFirst.mockResolvedValue({ id: 'user_1' });
    scopeService.getLeadTeamIds.mockResolvedValue(['team_1']);
    prisma.teamMember.findFirst.mockResolvedValue({ id: 'membership_1' });
    prisma.reviewEntry.create.mockResolvedValue({
      id: 'review_1',
      status: 'DRAFT',
      cycleId: 'cycle_1',
      reviewedUserId: 'user_1',
      reviewerId: 'lead_1',
      overallRating: 4,
    });
    prisma.reviewEntry.count.mockResolvedValue(0);
    prisma.reviewEntry.findMany.mockResolvedValue([]);
    prisma.$transaction.mockResolvedValue([0, []]);
  });

  it('allows TEAM_LEAD to create review for own-team user', async () => {
    const created = await service.createReviewEntry('tenant_1', teamLeadActor, {
      cycleId: 'cycle_1',
      reviewedUserId: 'user_1',
      overallRating: 4,
      strengths: 'Ownership',
      improvements: 'Communication',
      summary: 'Strong month',
    });

    expect(created.id).toBe('review_1');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REVIEW_CREATE',
        entityType: 'ReviewEntry',
        entityId: 'review_1',
      }),
    );
  });

  it('rejects TEAM_LEAD create when user is outside managed team', async () => {
    prisma.teamMember.findFirst.mockResolvedValue(null);

    await expect(
      service.createReviewEntry('tenant_1', teamLeadActor, {
        cycleId: 'cycle_1',
        reviewedUserId: 'user_2',
        overallRating: 4,
        strengths: 'Ownership',
        improvements: 'Communication',
        summary: 'Strong month',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects submit when review is not in DRAFT', async () => {
    prisma.reviewEntry.findFirst.mockResolvedValue({
      id: 'review_1',
      reviewerId: 'lead_1',
      status: 'SUBMITTED',
    });

    await expect(
      service.submitReviewEntry('tenant_1', teamLeadActor, 'review_1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows only SUPER_ADMIN to approve submitted review', async () => {
    prisma.reviewEntry.findFirst.mockResolvedValue({
      id: 'review_1',
      status: 'SUBMITTED',
    });
    prisma.reviewEntry.update.mockResolvedValue({
      id: 'review_1',
      status: 'APPROVED',
      approvedById: 'admin_1',
    });

    const userActor = {
      sub: 'lead_1',
      tenantId: 'tenant_1',
      roles: ['TEAM_LEAD'],
    } as Express.User;

    await expect(
      service.approveReviewEntry('tenant_1', userActor, 'review_1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const approved = await service.approveReviewEntry(
      'tenant_1',
      superAdminActor,
      'review_1',
    );

    expect(approved.status).toBe('APPROVED');
  });

  it('rejects approval when review is not submitted', async () => {
    prisma.reviewEntry.findFirst.mockResolvedValue({
      id: 'review_1',
      status: 'DRAFT',
    });

    await expect(
      service.approveReviewEntry('tenant_1', superAdminActor, 'review_1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws not found when cycle is missing', async () => {
    prisma.reviewCycle.findFirst.mockResolvedValue(null);

    await expect(
      service.createReviewEntry('tenant_1', teamLeadActor, {
        cycleId: 'missing_cycle',
        reviewedUserId: 'user_1',
        overallRating: 4,
        strengths: 'Ownership',
        improvements: 'Communication',
        summary: 'Strong month',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('restricts USER review listing to own review rows', async () => {
    const userActor = {
      sub: 'user_1',
      tenantId: 'tenant_1',
      roles: ['USER'],
    } as Express.User;

    await service.listReviewEntries('tenant_1', userActor, {});

    expect(prisma.reviewEntry.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant_1',
          reviewedUserId: 'user_1',
        }),
      }),
    );
  });

  it('restricts TEAM_LEAD review listing to team scope or own reviews', async () => {
    await service.listReviewEntries('tenant_1', teamLeadActor, {});

    expect(prisma.reviewEntry.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant_1',
          OR: expect.arrayContaining([
            expect.objectContaining({
              reviewerId: 'lead_1',
            }),
          ]),
        }),
      }),
    );
  });
});
