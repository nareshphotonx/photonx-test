import { ForbiddenException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const prisma = {
    user: { findMany: jest.fn(), findFirst: jest.fn() },
    teamMember: { findMany: jest.fn(), findFirst: jest.fn() },
  } as any;

  const scopeService = {
    isSuperAdmin: jest.fn(),
    isTeamLead: jest.fn(),
    isEndUser: jest.fn(),
    getLeadTeamIds: jest.fn(),
  } as any;

  const userPerformanceService = {
    buildScopedMetrics: jest.fn(),
  } as any;

  const projectDashboardService = {
    getProjectDashboard: jest.fn(),
  } as any;

  const service = new DashboardService(
    prisma,
    scopeService,
    userPerformanceService,
    projectDashboardService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    scopeService.isSuperAdmin.mockReturnValue(false);
    scopeService.isTeamLead.mockReturnValue(false);
    scopeService.isEndUser.mockReturnValue(false);
    userPerformanceService.buildScopedMetrics.mockResolvedValue({ usersCount: 0 });
  });

  it('restricts super-admin dashboard to SUPER_ADMIN role', async () => {
    const actor = {
      sub: 'user_1',
      tenantId: 'tenant_1',
      roles: ['USER'],
    } as Express.User;

    await expect(
      service.getSuperAdminDashboard('tenant_1', actor, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('restricts USER from reading another user performance', async () => {
    const actor = {
      sub: 'user_1',
      tenantId: 'tenant_1',
      roles: ['USER'],
    } as Express.User;

    scopeService.isEndUser.mockReturnValue(true);

    await expect(
      service.getUserPerformance('tenant_1', actor, 'user_2', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('restricts TEAM_LEAD to own-team user performance visibility', async () => {
    const actor = {
      sub: 'lead_1',
      tenantId: 'tenant_1',
      roles: ['TEAM_LEAD'],
    } as Express.User;

    scopeService.isTeamLead.mockReturnValue(true);
    scopeService.getLeadTeamIds.mockResolvedValue(['team_1']);
    prisma.teamMember.findFirst.mockResolvedValue(null);

    await expect(
      service.getUserPerformance('tenant_1', actor, 'user_2', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('builds TEAM_LEAD dashboard only for managed-team users', async () => {
    const actor = {
      sub: 'lead_1',
      tenantId: 'tenant_1',
      roles: ['TEAM_LEAD'],
    } as Express.User;

    scopeService.isTeamLead.mockReturnValue(true);
    scopeService.getLeadTeamIds.mockResolvedValue(['team_1']);
    prisma.teamMember.findMany.mockResolvedValue([
      { userId: 'user_1' },
      { userId: 'user_2' },
      { userId: 'user_1' },
    ]);

    await service.getTeamLeadDashboard('tenant_1', actor, {
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: new Date('2026-06-30T23:59:59.000Z'),
    });

    expect(userPerformanceService.buildScopedMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant_1',
        userIds: ['user_1', 'user_2'],
      }),
    );
  });
});
