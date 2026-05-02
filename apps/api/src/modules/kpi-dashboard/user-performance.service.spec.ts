import { UserPerformanceService } from './user-performance.service';

describe('UserPerformanceService', () => {
  const prisma = {
    task: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    timeEntry: {
      aggregate: jest.fn(),
    },
    attendanceDay: {
      aggregate: jest.fn(),
    },
    taskStatusTransition: {
      findMany: jest.fn(),
    },
    tenantSetting: {
      findUnique: jest.fn(),
    },
  } as any;

  const service = new UserPerformanceService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-30T12:00:00.000Z'));

    prisma.tenantSetting.findUnique.mockResolvedValue({
      extras: {
        officeStartTime: '09:30',
        officeEndTime: '18:30',
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('computes KPI formulas from database aggregates', async () => {
    prisma.task.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    prisma.task.aggregate.mockResolvedValue({
      _sum: {
        estimateHours: 40,
      },
    });
    prisma.timeEntry.aggregate.mockResolvedValue({
      _sum: {
        hours: 20,
      },
    });
    prisma.attendanceDay.aggregate.mockResolvedValue({
      _sum: {
        lateMinutes: 35,
        earlyLogoutMinutes: 50,
      },
    });
    prisma.task.findMany.mockResolvedValue([
      {
        id: 'task_1',
        key: 'T-101',
        title: 'Task one',
        taskStatusId: 'status_a',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      },
      {
        id: 'task_2',
        key: 'T-102',
        title: 'Task two',
        taskStatusId: 'status_b',
        createdAt: new Date('2026-06-20T00:00:00.000Z'),
      },
    ]);
    prisma.taskStatusTransition.findMany.mockResolvedValue([
      {
        taskId: 'task_1',
        toStatusId: 'status_a',
        enteredAt: new Date('2026-06-29T00:00:00.000Z'),
      },
      {
        taskId: 'task_2',
        toStatusId: 'status_x',
        enteredAt: new Date('2026-06-28T00:00:00.000Z'),
      },
    ]);

    const result = await service.buildScopedMetrics({
      tenantId: 'tenant_1',
      userIds: ['user_1', 'user_2'],
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: new Date('2026-06-30T23:59:59.000Z'),
    });

    expect(result.estimatedHours).toBe(40);
    expect(result.actualLoggedHours).toBe(20);
    expect(result.availableHours).toBe(396);
    expect(result.efficiency).toBe(2);
    expect(result.utilization).toBe(0.0505);
    expect(result.completionRate).toBe(0.6);
    expect(result.delayRate).toBe(0.2);
    expect(result.reopenRate).toBe(0.5);
    expect(result.lateMinutes).toBe(35);
    expect(result.earlyLogoutMinutes).toBe(50);
    expect(result.wipAging.averageDays).toBe(5.5);
    expect(result.wipAging.oldest[0]).toMatchObject({
      taskId: 'task_2',
      key: 'T-102',
      days: 10,
    });
  });

  it('returns null ratios when denominator is zero', async () => {
    prisma.task.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prisma.task.aggregate.mockResolvedValue({
      _sum: {
        estimateHours: 12,
      },
    });
    prisma.timeEntry.aggregate.mockResolvedValue({
      _sum: {
        hours: 0,
      },
    });
    prisma.attendanceDay.aggregate.mockResolvedValue({
      _sum: {
        lateMinutes: 0,
        earlyLogoutMinutes: 0,
      },
    });
    prisma.task.findMany.mockResolvedValue([]);
    prisma.taskStatusTransition.findMany.mockResolvedValue([]);

    const result = await service.buildScopedMetrics({
      tenantId: 'tenant_1',
      userIds: ['user_1'],
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: new Date('2026-06-30T23:59:59.000Z'),
    });

    expect(result.efficiency).toBeNull();
    expect(result.completionRate).toBeNull();
    expect(result.delayRate).toBeNull();
    expect(result.reopenRate).toBeNull();
  });
});
