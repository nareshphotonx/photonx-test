import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  businessDaysBetweenInclusive,
  daysDiffFloor,
  normalizeDateOnly,
  ratioOrNull,
  roundNumber,
} from './kpi-math.util';

interface ScopeMetricsInput {
  tenantId: string;
  userIds: string[];
  from: Date;
  to: Date;
  projectId?: string;
}

export interface WipAgingTask {
  taskId: string;
  key: string;
  title: string;
  days: number;
}

export interface ScopedKpiMetrics {
  usersCount: number;
  estimatedHours: number;
  actualLoggedHours: number;
  availableHours: number;
  efficiency: number | null;
  utilization: number | null;
  completionRate: number | null;
  delayRate: number | null;
  reopenRate: number | null;
  lateMinutes: number;
  earlyLogoutMinutes: number;
  totalAssignedTasks: number;
  completedTasks: number;
  delayedTasks: number;
  reopenedTasks: number;
  wipAging: {
    averageDays: number | null;
    oldest: WipAgingTask[];
  };
}

@Injectable()
export class UserPerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async buildScopedMetrics(input: ScopeMetricsInput): Promise<ScopedKpiMetrics> {
    const scopedUserIds = Array.from(new Set(input.userIds));

    if (scopedUserIds.length === 0) {
      return {
        usersCount: 0,
        estimatedHours: 0,
        actualLoggedHours: 0,
        availableHours: 0,
        efficiency: null,
        utilization: null,
        completionRate: null,
        delayRate: null,
        reopenRate: null,
        lateMinutes: 0,
        earlyLogoutMinutes: 0,
        totalAssignedTasks: 0,
        completedTasks: 0,
        delayedTasks: 0,
        reopenedTasks: 0,
        wipAging: {
          averageDays: null,
          oldest: [],
        },
      };
    }

    const now = new Date();

    const taskWhere = {
      tenantId: input.tenantId,
      assigneeId: { in: scopedUserIds },
      deletedAt: null,
      createdAt: {
        gte: input.from,
        lte: input.to,
      },
      ...(input.projectId ? { projectId: input.projectId } : {}),
    } as const;

    const [
      totalAssignedTasks,
      completedTasks,
      delayedTasks,
      reopenedTasks,
      taskSums,
      loggedHoursAgg,
      attendanceAgg,
      activeTasks,
      officeHoursPerDay,
    ] = await Promise.all([
      this.prisma.task.count({
        where: taskWhere,
      }),
      this.prisma.task.count({
        where: {
          ...taskWhere,
          status: { isDone: true },
        },
      }),
      this.prisma.task.count({
        where: {
          ...taskWhere,
          dueDate: { lt: now },
          status: { isDone: false },
        },
      }),
      this.prisma.task.count({
        where: {
          ...taskWhere,
          reopenedCount: { gt: 0 },
          status: { isDone: true },
        },
      }),
      this.prisma.task.aggregate({
        where: taskWhere,
        _sum: {
          estimateHours: true,
        },
      }),
      this.prisma.timeEntry.aggregate({
        where: {
          tenantId: input.tenantId,
          userId: { in: scopedUserIds },
          entryDate: {
            gte: input.from,
            lte: input.to,
          },
          ...(input.projectId ? { projectId: input.projectId } : {}),
        },
        _sum: {
          hours: true,
        },
      }),
      this.prisma.attendanceDay.aggregate({
        where: {
          tenantId: input.tenantId,
          userId: { in: scopedUserIds },
          date: {
            gte: normalizeDateOnly(input.from),
            lte: normalizeDateOnly(input.to),
          },
        },
        _sum: {
          lateMinutes: true,
          earlyLogoutMinutes: true,
        },
      }),
      this.prisma.task.findMany({
        where: {
          ...taskWhere,
          status: { isDone: false },
        },
        select: {
          id: true,
          key: true,
          title: true,
          taskStatusId: true,
          createdAt: true,
        },
      }),
      this.getOfficeHoursPerDay(input.tenantId),
    ]);

    const transitionAging = await this.getWipAging(
      input.tenantId,
      activeTasks,
      now,
    );

    const usersCount = scopedUserIds.length;
    const estimatedHours = Number(taskSums._sum.estimateHours ?? 0);
    const actualLoggedHours = Number(loggedHoursAgg._sum.hours ?? 0);
    const businessDays = businessDaysBetweenInclusive(input.from, input.to);
    const availableHours = officeHoursPerDay * businessDays * usersCount;

    return {
      usersCount,
      estimatedHours: roundNumber(estimatedHours),
      actualLoggedHours: roundNumber(actualLoggedHours),
      availableHours: roundNumber(availableHours),
      efficiency: ratioOrNull(estimatedHours, actualLoggedHours),
      utilization: ratioOrNull(actualLoggedHours, availableHours),
      completionRate: ratioOrNull(completedTasks, totalAssignedTasks),
      delayRate: ratioOrNull(delayedTasks, totalAssignedTasks),
      reopenRate: ratioOrNull(reopenedTasks, completedTasks),
      lateMinutes: attendanceAgg._sum.lateMinutes ?? 0,
      earlyLogoutMinutes: attendanceAgg._sum.earlyLogoutMinutes ?? 0,
      totalAssignedTasks,
      completedTasks,
      delayedTasks,
      reopenedTasks,
      wipAging: transitionAging,
    };
  }

  private async getWipAging(
    tenantId: string,
    activeTasks: Array<{
      id: string;
      key: string;
      title: string;
      taskStatusId: string;
      createdAt: Date;
    }>,
    now: Date,
  ): Promise<{ averageDays: number | null; oldest: WipAgingTask[] }> {
    if (activeTasks.length === 0) {
      return {
        averageDays: null,
        oldest: [],
      };
    }

    const transitions = await this.prisma.taskStatusTransition.findMany({
      where: {
        tenantId,
        taskId: {
          in: activeTasks.map((entry) => entry.id),
        },
      },
      select: {
        taskId: true,
        toStatusId: true,
        enteredAt: true,
      },
      orderBy: {
        enteredAt: 'desc',
      },
    });

    const transitionsByTask = new Map<string, Array<{ toStatusId: string; enteredAt: Date }>>();
    for (const row of transitions) {
      const list = transitionsByTask.get(row.taskId) ?? [];
      list.push({ toStatusId: row.toStatusId, enteredAt: row.enteredAt });
      transitionsByTask.set(row.taskId, list);
    }

    const wipAging = activeTasks.map((task) => {
      const matched = (transitionsByTask.get(task.id) ?? []).find(
        (entry) => entry.toStatusId === task.taskStatusId,
      );
      const baseline = matched?.enteredAt ?? task.createdAt;
      return {
        taskId: task.id,
        key: task.key,
        title: task.title,
        days: daysDiffFloor(baseline, now),
      };
    });

    const averageDays =
      wipAging.length > 0
        ? roundNumber(
            wipAging.reduce((acc, row) => acc + row.days, 0) / wipAging.length,
          )
        : null;

    return {
      averageDays,
      oldest: wipAging.sort((a, b) => b.days - a.days).slice(0, 5),
    };
  }

  private async getOfficeHoursPerDay(tenantId: string): Promise<number> {
    const setting = await this.prisma.tenantSetting.findUnique({
      where: { tenantId },
      select: { extras: true },
    });

    const extras = (setting?.extras ?? {}) as Record<string, unknown>;
    const officeStart = typeof extras.officeStartTime === 'string' ? extras.officeStartTime : '09:30';
    const officeEnd = typeof extras.officeEndTime === 'string' ? extras.officeEndTime : '18:30';

    return this.computeHoursBetween(officeStart, officeEnd);
  }

  private computeHoursBetween(start: string, end: string): number {
    const startMinutes = this.parseMinutes(start);
    const endMinutes = this.parseMinutes(end);

    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      return 9;
    }

    return (endMinutes - startMinutes) / 60;
  }

  private parseMinutes(value: string): number | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) {
      return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
      return null;
    }

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    return hours * 60 + minutes;
  }
}
