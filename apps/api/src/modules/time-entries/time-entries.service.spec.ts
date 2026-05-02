import { BadRequestException } from '@nestjs/common';
import { TimeEntrySource } from '@prisma/client';
import { TimeEntriesService } from './time-entries.service';

describe('TimeEntriesService', () => {
  const prisma = {
    tenantSetting: { findUnique: jest.fn() },
    task: { findFirst: jest.fn() },
    project: { findFirst: jest.fn() },
    rateCard: { findFirst: jest.fn() },
    timeEntry: {
      create: jest.fn(),
      aggregate: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    timeEntryUnlock: { findFirst: jest.fn(), create: jest.fn() },
    projectMember: { findMany: jest.fn() },
    teamMember: { findMany: jest.fn() },
  } as any;

  const auditService = {
    log: jest.fn(),
  } as any;

  const scopeService = {
    ensureProjectReadAccess: jest.fn(),
    ensureProjectManageAccess: jest.fn(),
    isSuperAdmin: jest.fn(),
    isTeamLead: jest.fn(),
    isEndUser: jest.fn(),
    getLeadTeamIds: jest.fn(),
  } as any;

  const budgetAlertsService = {
    evaluateProjectBudget: jest.fn(),
  } as any;

  const service = new TimeEntriesService(
    prisma,
    auditService,
    scopeService,
    budgetAlertsService,
  );

  const actor: Express.User = {
    sub: 'user_1',
    tenantId: 'tenant_1',
    sessionId: 'session_1',
    roles: ['USER'],
    permissions: ['time_entries:create'],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    scopeService.isSuperAdmin.mockReturnValue(false);
    scopeService.isTeamLead.mockReturnValue(false);
    scopeService.isEndUser.mockReturnValue(true);

    prisma.tenantSetting.findUnique.mockResolvedValue({
      currency: 'INR',
      extras: {
        timeEntryDailyCapHours: 12,
        timeEntryLockDays: 7,
      },
    });
    prisma.timeEntry.aggregate.mockResolvedValue({
      _sum: { hours: 0 },
    });
    prisma.project.findFirst.mockResolvedValue({
      id: 'project_1',
      overheadPercent: 10,
    });
    prisma.rateCard.findFirst.mockResolvedValue({
      id: 'rate_1',
      hourlyRate: 100,
      currency: 'INR',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    });
    prisma.timeEntry.create.mockResolvedValue({
      id: 'time_entry_1',
      projectId: 'project_1',
      userId: 'user_1',
      source: TimeEntrySource.MANUAL,
      hours: 2,
    });
    scopeService.ensureProjectReadAccess.mockResolvedValue({});
    budgetAlertsService.evaluateProjectBudget.mockResolvedValue({ triggered: [] });
  });

  it('creates adjustment as append-only row without mutating original', async () => {
    const entryDate = new Date();

    prisma.timeEntry.findFirst.mockResolvedValue({
      id: 'time_entry_parent',
      tenantId: 'tenant_1',
      userId: 'user_1',
      projectId: 'project_1',
      taskId: null,
      entryDate,
      source: TimeEntrySource.MANUAL,
      externalRef: null,
    });

    await service.adjustTimeEntry('tenant_1', actor, 'time_entry_parent', {
      hoursDelta: -1,
      reason: 'Correction',
      note: 'Approved',
    });

    expect(prisma.timeEntry.create).toHaveBeenCalled();
    expect((prisma.timeEntry as any).update).toBeUndefined();
    expect(prisma.timeEntry.create.mock.calls[0][0].data.parentEntryId).toBe(
      'time_entry_parent',
    );
  });

  it('rejects write when daily cap would be exceeded', async () => {
    prisma.timeEntry.aggregate.mockResolvedValue({
      _sum: { hours: 11.75 },
    });

    await expect(
      service.createTimeEntry('tenant_1', actor, {
        projectId: 'project_1',
        entryDate: new Date(),
        hours: 0.5,
        source: TimeEntrySource.MANUAL,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.timeEntry.create).not.toHaveBeenCalled();
  });

  it('stores immutable rate and cost snapshot on create', async () => {
    await service.createTimeEntry('tenant_1', actor, {
      projectId: 'project_1',
      entryDate: new Date(),
      hours: 2,
      source: TimeEntrySource.MANUAL,
    });

    expect(prisma.timeEntry.create).toHaveBeenCalled();

    const payload = prisma.timeEntry.create.mock.calls[0][0].data;
    expect(payload.rateSnapshot).toMatchObject({
      rateCardId: 'rate_1',
      hourlyRate: 100,
      currency: 'INR',
    });
    expect(payload.costSnapshot).toMatchObject({
      laborCost: 200,
      overheadPercentApplied: 10,
      overheadCost: 20,
      totalLaborWithOverhead: 220,
    });
  });
});
