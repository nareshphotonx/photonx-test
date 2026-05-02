import { ForbiddenException } from '@nestjs/common';
import { ProjectDashboardService } from './project-dashboard.service';

describe('ProjectDashboardService', () => {
  const prisma = {
    project: { findFirst: jest.fn() },
    projectMember: { findMany: jest.fn() },
    teamMember: { findMany: jest.fn() },
  } as any;

  const scopeService = {
    ensureProjectReadAccess: jest.fn(),
    isEndUser: jest.fn(),
    isSuperAdmin: jest.fn(),
    getLeadTeamIds: jest.fn(),
  } as any;

  const userPerformanceService = {
    buildScopedMetrics: jest.fn(),
  } as any;

  const projectCostingService = {
    calculateProjectCostComponents: jest.fn(),
  } as any;

  const service = new ProjectDashboardService(
    prisma,
    scopeService,
    userPerformanceService,
    projectCostingService,
  );

  const adminActor = {
    sub: 'admin_1',
    tenantId: 'tenant_1',
    roles: ['SUPER_ADMIN'],
  } as Express.User;

  beforeEach(() => {
    jest.clearAllMocks();
    scopeService.ensureProjectReadAccess.mockResolvedValue({});
    scopeService.isEndUser.mockReturnValue(false);
    scopeService.isSuperAdmin.mockReturnValue(true);
    prisma.projectMember.findMany.mockResolvedValue([{ userId: 'user_1' }]);
    prisma.teamMember.findMany.mockResolvedValue([{ userId: 'user_1' }]);
    userPerformanceService.buildScopedMetrics.mockResolvedValue({ usersCount: 1 });
    projectCostingService.calculateProjectCostComponents.mockResolvedValue({
      laborCost: 200,
      projectCosts: 150,
      overheadCost: 50,
      totalBurn: 400,
    });
    prisma.project.findFirst.mockResolvedValue({
      id: 'project_1',
      name: 'Alpha',
      code: 'T',
      billableAmount: 1000,
      billableCurrency: 'INR',
    });
  });

  it('computes project margin from database-backed burn values', async () => {
    const result = await service.getProjectDashboard(
      'tenant_1',
      adminActor,
      'project_1',
      new Date('2026-06-01T00:00:00.000Z'),
      new Date('2026-06-30T23:59:59.000Z'),
    );

    expect(result.financials).toMatchObject({
      laborCost: 200,
      expenseCost: 150,
      overheadCost: 50,
      totalBurn: 400,
      billableAmount: 1000,
      margin: 0.6,
    });
  });

  it('returns null margin when billable amount is missing', async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: 'project_1',
      name: 'Alpha',
      code: 'T',
      billableAmount: null,
      billableCurrency: null,
    });

    const result = await service.getProjectDashboard(
      'tenant_1',
      adminActor,
      'project_1',
      new Date('2026-06-01T00:00:00.000Z'),
      new Date('2026-06-30T23:59:59.000Z'),
    );

    expect(result.financials.margin).toBeNull();
  });

  it('blocks USER from project dashboard access', async () => {
    const userActor = {
      sub: 'user_1',
      tenantId: 'tenant_1',
      roles: ['USER'],
    } as Express.User;

    scopeService.isEndUser.mockReturnValue(true);

    await expect(
      service.getProjectDashboard(
        'tenant_1',
        userActor,
        'project_1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.000Z'),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
