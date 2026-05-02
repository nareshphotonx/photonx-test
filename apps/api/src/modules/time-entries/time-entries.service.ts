import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TimeEntrySource,
  TimeEntryType,
} from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BudgetAlertsService } from '../../common/services/budget-alerts.service';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { AuditService } from '../audit/audit.service';
import { AdjustTimeEntryDto } from './dto/adjust-time-entry.dto';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { ListTimeEntriesDto } from './dto/list-time-entries.dto';
import { ManagerBulkTimeEntriesDto } from './dto/manager-bulk-time-entries.dto';
import { TimeEntriesSummaryDto } from './dto/time-entries-summary.dto';
import { UnlockTimeEntryDto } from './dto/unlock-time-entry.dto';

interface TenantTimePolicy {
  currency: string;
  dailyCapHours: number;
  lockDays: number;
}

@Injectable()
export class TimeEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly scopeService: TenantRbacScopeService,
    private readonly budgetAlertsService: BudgetAlertsService,
  ) {}

  async createTimeEntry(
    tenantId: string,
    actor: Express.User,
    dto: CreateTimeEntryDto,
  ) {
    this.ensureQuarterHourIncrement(dto.hours);

    if (dto.hours <= 0) {
      throw new BadRequestException('Hours must be greater than zero');
    }

    if (dto.source === TimeEntrySource.MANAGER_BULK) {
      throw new BadRequestException(
        'MANAGER_BULK source is only allowed via manager bulk endpoint',
      );
    }

    const entryDate = this.normalizeDateOnly(dto.entryDate);
    const policy = await this.getTenantTimePolicy(tenantId);

    if (this.isEntryDateLocked(entryDate, policy.lockDays)) {
      throw new BadRequestException('Entry date is locked based on tenant policy');
    }

    const userId = actor.sub;

    await this.scopeService.ensureProjectReadAccess(tenantId, dto.projectId, actor);

    if (dto.taskId) {
      await this.assertTaskInProject(tenantId, dto.projectId, dto.taskId);
    }

    await this.assertDailyCap(tenantId, userId, entryDate, dto.hours, policy.dailyCapHours);

    const project = await this.getProjectCostContext(tenantId, dto.projectId);
    const rate = await this.resolveRateCard(tenantId, userId, entryDate, policy.currency);

    const entry = await this.prisma.timeEntry.create({
      data: {
        tenantId,
        userId,
        projectId: dto.projectId,
        taskId: dto.taskId,
        entryDate,
        hours: new Prisma.Decimal(dto.hours),
        type: TimeEntryType.WORK,
        source: dto.source,
        note: dto.note,
        externalRef: dto.externalRef,
        rateSnapshot: {
          rateCardId: rate.id,
          hourlyRate: Number(rate.hourlyRate),
          currency: rate.currency,
          effectiveFrom: rate.effectiveFrom.toISOString(),
        },
        costSnapshot: this.buildCostSnapshot(
          dto.hours,
          Number(rate.hourlyRate),
          rate.currency,
          Number(project.overheadPercent ?? 0),
        ),
        createdBy: actor.sub,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'TIME_ENTRY_CREATE',
      entityType: 'TimeEntry',
      entityId: entry.id,
      metadata: {
        projectId: entry.projectId,
        userId: entry.userId,
        source: entry.source,
        hours: Number(entry.hours),
      },
    });

    await this.budgetAlertsService.evaluateProjectBudget(tenantId, dto.projectId, actor.sub);

    return entry;
  }

  async listTimeEntries(
    tenantId: string,
    actor: Express.User,
    query: ListTimeEntriesDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.TimeEntryWhereInput = {
      tenantId,
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.taskId ? { taskId: query.taskId } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.from || query.to
        ? {
            entryDate: {
              gte: query.from ? this.normalizeDateOnly(query.from) : undefined,
              lte: query.to ? this.normalizeDateOnly(query.to) : undefined,
            },
          }
        : {}),
    };

    await this.applyEntryVisibilityWhere(tenantId, actor, where);

    const [total, entries] = await this.prisma.$transaction([
      this.prisma.timeEntry.count({ where }),
      this.prisma.timeEntry.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          task: {
            select: {
              id: true,
              key: true,
              title: true,
            },
          },
        },
        orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: entries,
      page,
      limit,
      total,
    };
  }

  async adjustTimeEntry(
    tenantId: string,
    actor: Express.User,
    timeEntryId: string,
    dto: AdjustTimeEntryDto,
  ) {
    this.ensureQuarterHourIncrement(dto.hoursDelta);

    if (dto.hoursDelta === 0) {
      throw new BadRequestException('Adjustment delta cannot be zero');
    }

    const parentEntry = await this.prisma.timeEntry.findFirst({
      where: {
        tenantId,
        id: timeEntryId,
      },
    });

    if (!parentEntry) {
      throw new NotFoundException('Time entry not found');
    }

    await this.assertAdjustmentAccess(tenantId, actor, parentEntry.projectId, parentEntry.userId);

    const policy = await this.getTenantTimePolicy(tenantId);
    const entryDate = this.normalizeDateOnly(parentEntry.entryDate);

    if (this.isEntryDateLocked(entryDate, policy.lockDays)) {
      const unlocked = await this.hasActiveUnlock(tenantId, parentEntry.id);
      if (!unlocked) {
        throw new BadRequestException('Entry is locked and requires manager unlock');
      }
    }

    await this.assertDailyCap(
      tenantId,
      parentEntry.userId,
      entryDate,
      dto.hoursDelta,
      policy.dailyCapHours,
    );

    const project = await this.getProjectCostContext(tenantId, parentEntry.projectId);
    const rate = await this.resolveRateCard(
      tenantId,
      parentEntry.userId,
      entryDate,
      policy.currency,
    );

    const adjustment = await this.prisma.timeEntry.create({
      data: {
        tenantId,
        userId: parentEntry.userId,
        projectId: parentEntry.projectId,
        taskId: parentEntry.taskId,
        parentEntryId: parentEntry.id,
        entryDate,
        hours: new Prisma.Decimal(dto.hoursDelta),
        type: TimeEntryType.ADJUSTMENT,
        source: TimeEntrySource.MANUAL,
        note: dto.note ? `${dto.reason} | ${dto.note}` : dto.reason,
        externalRef: parentEntry.externalRef,
        rateSnapshot: {
          rateCardId: rate.id,
          hourlyRate: Number(rate.hourlyRate),
          currency: rate.currency,
          effectiveFrom: rate.effectiveFrom.toISOString(),
        },
        costSnapshot: this.buildCostSnapshot(
          dto.hoursDelta,
          Number(rate.hourlyRate),
          rate.currency,
          Number(project.overheadPercent ?? 0),
        ),
        createdBy: actor.sub,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'TIME_ENTRY_ADJUST',
      entityType: 'TimeEntry',
      entityId: adjustment.id,
      metadata: {
        parentEntryId: parentEntry.id,
        userId: parentEntry.userId,
        hoursDelta: dto.hoursDelta,
      },
    });

    await this.budgetAlertsService.evaluateProjectBudget(
      tenantId,
      parentEntry.projectId,
      actor.sub,
    );

    return adjustment;
  }

  async unlockTimeEntry(
    tenantId: string,
    actor: Express.User,
    timeEntryId: string,
    dto: UnlockTimeEntryDto,
  ) {
    if (!this.isManagerOrAdmin(actor)) {
      throw new ForbiddenException('Only TEAM_LEAD or SUPER_ADMIN can unlock entries');
    }

    const entry = await this.prisma.timeEntry.findFirst({
      where: {
        tenantId,
        id: timeEntryId,
      },
      select: {
        id: true,
        projectId: true,
      },
    });

    if (!entry) {
      throw new NotFoundException('Time entry not found');
    }

    await this.scopeService.ensureProjectManageAccess(tenantId, entry.projectId, actor);

    const unlock = await this.prisma.timeEntryUnlock.create({
      data: {
        tenantId,
        timeEntryId: entry.id,
        unlockedBy: actor.sub,
        reason: dto.reason,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'TIME_ENTRY_UNLOCK',
      entityType: 'TimeEntryUnlock',
      entityId: unlock.id,
      metadata: {
        timeEntryId: entry.id,
        reason: dto.reason,
      },
    });

    return unlock;
  }

  async getSummary(
    tenantId: string,
    actor: Express.User,
    query: TimeEntriesSummaryDto,
  ) {
    const where: Prisma.TimeEntryWhereInput = {
      tenantId,
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.from || query.to
        ? {
            entryDate: {
              gte: query.from ? this.normalizeDateOnly(query.from) : undefined,
              lte: query.to ? this.normalizeDateOnly(query.to) : undefined,
            },
          }
        : {}),
    };

    await this.applyEntryVisibilityWhere(tenantId, actor, where);

    const entries = await this.prisma.timeEntry.findMany({
      where,
      select: {
        entryDate: true,
        hours: true,
        costSnapshot: true,
      },
      orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
    });

    const grouped = new Map<
      string,
      { hours: number; laborCost: number; overheadCost: number; totalCost: number }
    >();

    for (const entry of entries) {
      const date = entry.entryDate.toISOString().slice(0, 10);
      const bucket = grouped.get(date) ?? {
        hours: 0,
        laborCost: 0,
        overheadCost: 0,
        totalCost: 0,
      };

      const snapshot = entry.costSnapshot as
        | {
            laborCost?: unknown;
            overheadCost?: unknown;
            totalLaborWithOverhead?: unknown;
          }
        | null;

      const laborCost = this.asNumber(snapshot?.laborCost);
      const overheadCost = this.asNumber(snapshot?.overheadCost);
      const total =
        this.asNumber(snapshot?.totalLaborWithOverhead) || laborCost + overheadCost;

      bucket.hours += Number(entry.hours);
      bucket.laborCost += laborCost;
      bucket.overheadCost += overheadCost;
      bucket.totalCost += total;

      grouped.set(date, bucket);
    }

    const days = Array.from(grouped.entries()).map(([date, data]) => ({
      date,
      hours: Number(data.hours.toFixed(2)),
      laborCost: Number(data.laborCost.toFixed(2)),
      overheadCost: Number(data.overheadCost.toFixed(2)),
      totalCost: Number(data.totalCost.toFixed(2)),
    }));

    const totals = days.reduce(
      (acc, day) => {
        acc.hours += day.hours;
        acc.laborCost += day.laborCost;
        acc.overheadCost += day.overheadCost;
        acc.totalCost += day.totalCost;
        return acc;
      },
      { hours: 0, laborCost: 0, overheadCost: 0, totalCost: 0 },
    );

    return {
      days,
      totals: {
        hours: Number(totals.hours.toFixed(2)),
        laborCost: Number(totals.laborCost.toFixed(2)),
        overheadCost: Number(totals.overheadCost.toFixed(2)),
        totalCost: Number(totals.totalCost.toFixed(2)),
      },
    };
  }

  async managerBulkCreate(
    tenantId: string,
    actor: Express.User,
    dto: ManagerBulkTimeEntriesDto,
  ): Promise<{
    total: number;
    created: number;
    failed: number;
    errors: Array<{ index: number; reason: string }>;
  }> {
    if (!this.isManagerOrAdmin(actor)) {
      throw new ForbiddenException('Only TEAM_LEAD or SUPER_ADMIN can use manager bulk');
    }

    const policy = await this.getTenantTimePolicy(tenantId);
    let created = 0;
    let failed = 0;
    const errors: Array<{ index: number; reason: string }> = [];

    for (const [index, item] of dto.entries.entries()) {
      try {
        this.ensureQuarterHourIncrement(item.hours);

        if (item.hours <= 0) {
          throw new BadRequestException('Hours must be greater than zero');
        }

        const entryDate = this.normalizeDateOnly(item.entryDate);

        if (this.isEntryDateLocked(entryDate, policy.lockDays)) {
          throw new BadRequestException('Entry date is locked based on tenant policy');
        }

        await this.scopeService.ensureProjectManageAccess(
          tenantId,
          item.projectId,
          actor,
        );

        const targetUser = await this.prisma.user.findFirst({
          where: {
            tenantId,
            id: item.userId,
            deletedAt: null,
            isActive: true,
          },
          select: { id: true },
        });

        if (!targetUser) {
          throw new BadRequestException('User not found or inactive in tenant');
        }

        if (this.scopeService.isTeamLead(actor)) {
          await this.assertTeamLeadUserOverlap(tenantId, actor.sub, item.userId);
        }

        if (item.taskId) {
          await this.assertTaskInProject(tenantId, item.projectId, item.taskId);
        }

        await this.assertDailyCap(
          tenantId,
          item.userId,
          entryDate,
          item.hours,
          policy.dailyCapHours,
        );

        const project = await this.getProjectCostContext(tenantId, item.projectId);
        const rate = await this.resolveRateCard(
          tenantId,
          item.userId,
          entryDate,
          policy.currency,
        );

        const entry = await this.prisma.timeEntry.create({
          data: {
            tenantId,
            userId: item.userId,
            projectId: item.projectId,
            taskId: item.taskId,
            entryDate,
            hours: new Prisma.Decimal(item.hours),
            type: TimeEntryType.WORK,
            source: TimeEntrySource.MANAGER_BULK,
            note: item.note,
            externalRef: item.externalRef,
            rateSnapshot: {
              rateCardId: rate.id,
              hourlyRate: Number(rate.hourlyRate),
              currency: rate.currency,
              effectiveFrom: rate.effectiveFrom.toISOString(),
            },
            costSnapshot: this.buildCostSnapshot(
              item.hours,
              Number(rate.hourlyRate),
              rate.currency,
              Number(project.overheadPercent ?? 0),
            ),
            createdBy: actor.sub,
          },
        });

        await this.auditService.log({
          tenantId,
          actorId: actor.sub,
          action: 'TIME_ENTRY_MANAGER_BULK_CREATE',
          entityType: 'TimeEntry',
          entityId: entry.id,
          metadata: {
            userId: item.userId,
            projectId: item.projectId,
            hours: item.hours,
          },
        });

        await this.budgetAlertsService.evaluateProjectBudget(
          tenantId,
          item.projectId,
          actor.sub,
        );

        created += 1;
      } catch (error) {
        failed += 1;
        errors.push({
          index,
          reason: error instanceof Error ? error.message : 'Unknown bulk error',
        });
      }
    }

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'TIME_ENTRY_MANAGER_BULK',
      entityType: 'TimeEntry',
      metadata: {
        total: dto.entries.length,
        created,
        failed,
      },
    });

    return {
      total: dto.entries.length,
      created,
      failed,
      errors,
    };
  }

  private ensureQuarterHourIncrement(hours: number): void {
    if (!Number.isFinite(hours)) {
      throw new BadRequestException('Hours must be a finite number');
    }

    const scaled = hours * 4;
    if (Math.abs(scaled - Math.round(scaled)) > 1e-8) {
      throw new BadRequestException('Hours must be in 0.25 increments');
    }
  }

  private normalizeDateOnly(input: Date): Date {
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  }

  private async getTenantTimePolicy(tenantId: string): Promise<TenantTimePolicy> {
    const settings = await this.prisma.tenantSetting.findUnique({
      where: { tenantId },
      select: {
        currency: true,
        extras: true,
      },
    });

    const extras =
      settings?.extras && typeof settings.extras === 'object'
        ? (settings.extras as Record<string, unknown>)
        : {};

    const dailyCapRaw = extras.timeEntryDailyCapHours;
    const lockDaysRaw = extras.timeEntryLockDays;

    const dailyCapHours =
      typeof dailyCapRaw === 'number' && dailyCapRaw > 0
        ? dailyCapRaw
        : typeof dailyCapRaw === 'string' && Number(dailyCapRaw) > 0
          ? Number(dailyCapRaw)
          : 12;

    const lockDays =
      typeof lockDaysRaw === 'number' && lockDaysRaw >= 0
        ? Math.floor(lockDaysRaw)
        : typeof lockDaysRaw === 'string' && Number(lockDaysRaw) >= 0
          ? Math.floor(Number(lockDaysRaw))
          : 7;

    return {
      currency: settings?.currency ?? 'INR',
      dailyCapHours,
      lockDays,
    };
  }

  private isEntryDateLocked(entryDate: Date, lockDays: number): boolean {
    const today = new Date();
    const utcTodayStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    utcTodayStart.setUTCDate(utcTodayStart.getUTCDate() - lockDays);

    return entryDate < utcTodayStart;
  }

  private async hasActiveUnlock(tenantId: string, timeEntryId: string): Promise<boolean> {
    const unlock = await this.prisma.timeEntryUnlock.findFirst({
      where: {
        tenantId,
        timeEntryId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });

    return Boolean(unlock);
  }

  private async assertDailyCap(
    tenantId: string,
    userId: string,
    entryDate: Date,
    deltaHours: number,
    dailyCapHours: number,
  ): Promise<void> {
    const aggregate = await this.prisma.timeEntry.aggregate({
      where: {
        tenantId,
        userId,
        entryDate,
      },
      _sum: {
        hours: true,
      },
    });

    const existing = Number(aggregate._sum.hours ?? 0);
    const next = existing + deltaHours;

    if (next > dailyCapHours + 1e-8) {
      throw new BadRequestException(
        `Daily cap exceeded (${dailyCapHours}h). Current: ${existing}, requested delta: ${deltaHours}`,
      );
    }
  }

  private async resolveRateCard(
    tenantId: string,
    userId: string,
    entryDate: Date,
    tenantCurrency: string,
  ) {
    const rateCard = await this.prisma.rateCard.findFirst({
      where: {
        tenantId,
        userId,
        isActive: true,
        effectiveFrom: { lte: entryDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: entryDate } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });

    if (!rateCard) {
      throw new BadRequestException('No active rate card found for user and date');
    }

    if (rateCard.currency !== tenantCurrency) {
      throw new BadRequestException(
        `Rate card currency (${rateCard.currency}) must match tenant currency (${tenantCurrency})`,
      );
    }

    return rateCard;
  }

  private buildCostSnapshot(
    hours: number,
    hourlyRate: number,
    currency: string,
    overheadPercent: number,
  ): Prisma.InputJsonValue {
    const laborCost = hours * hourlyRate;
    const overheadCost = (laborCost * overheadPercent) / 100;
    const totalLaborWithOverhead = laborCost + overheadCost;

    return {
      laborCost: Number(laborCost.toFixed(2)),
      currency,
      overheadPercentApplied: Number(overheadPercent.toFixed(2)),
      overheadCost: Number(overheadCost.toFixed(2)),
      totalLaborWithOverhead: Number(totalLaborWithOverhead.toFixed(2)),
    };
  }

  private asNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  private async applyEntryVisibilityWhere(
    tenantId: string,
    actor: Express.User,
    where: Prisma.TimeEntryWhereInput,
  ): Promise<void> {
    if (this.scopeService.isSuperAdmin(actor)) {
      return;
    }

    if (this.scopeService.isEndUser(actor)) {
      where.userId = actor.sub;
      return;
    }

    const [leadTeamIds, actorProjectMemberships] = await Promise.all([
      this.scopeService.getLeadTeamIds(tenantId, actor.sub),
      this.prisma.projectMember.findMany({
        where: {
          tenantId,
          userId: actor.sub,
        },
        select: {
          projectId: true,
        },
      }),
    ]);

    const projectIds = actorProjectMemberships.map((row) => row.projectId);

    if (projectIds.length === 0) {
      where.id = '__no_entries__';
      return;
    }

    const whereProjectId =
      typeof where.projectId === 'string' ? where.projectId : undefined;

    where.projectId =
      whereProjectId && projectIds.includes(whereProjectId)
        ? whereProjectId
        : whereProjectId
          ? '__no_entries__'
          : { in: projectIds };

    where.OR = [
      { userId: actor.sub },
      {
        user: {
          teamMembership: {
            some: {
              tenantId,
              teamId: {
                in: leadTeamIds.length > 0 ? leadTeamIds : ['__no_team__'],
              },
            },
          },
        },
      },
    ];
  }

  private async assertTaskInProject(
    tenantId: string,
    projectId: string,
    taskId: string,
  ): Promise<void> {
    const task = await this.prisma.task.findFirst({
      where: {
        tenantId,
        projectId,
        id: taskId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!task) {
      throw new BadRequestException('Task not found in provided project');
    }
  }

  private async getProjectCostContext(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        tenantId,
        id: projectId,
        deletedAt: null,
      },
      select: {
        id: true,
        overheadPercent: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  private isManagerOrAdmin(actor: Express.User): boolean {
    return actor.roles.includes(Role.SUPER_ADMIN) || actor.roles.includes(Role.TEAM_LEAD);
  }

  private async assertAdjustmentAccess(
    tenantId: string,
    actor: Express.User,
    projectId: string,
    userId: string,
  ): Promise<void> {
    if (this.scopeService.isSuperAdmin(actor)) {
      return;
    }

    if (this.scopeService.isTeamLead(actor)) {
      await this.scopeService.ensureProjectManageAccess(tenantId, projectId, actor);
      await this.assertTeamLeadUserOverlap(tenantId, actor.sub, userId);
      return;
    }

    if (actor.sub !== userId) {
      throw new ForbiddenException('USER can only adjust own entries');
    }
  }

  private async assertTeamLeadUserOverlap(
    tenantId: string,
    leadUserId: string,
    targetUserId: string,
  ): Promise<void> {
    const [leadTeamIds, targetTeamRows] = await Promise.all([
      this.scopeService.getLeadTeamIds(tenantId, leadUserId),
      this.prisma.teamMember.findMany({
        where: {
          tenantId,
          userId: targetUserId,
        },
        select: {
          teamId: true,
        },
      }),
    ]);

    const targetTeamIds = targetTeamRows.map((row) => row.teamId);
    const overlap = targetTeamIds.some((teamId) => leadTeamIds.includes(teamId));

    if (!overlap) {
      throw new ForbiddenException(
        'TEAM_LEAD access requires user team overlap',
      );
    }
  }
}
