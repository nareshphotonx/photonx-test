import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalTargetType,
  LeaveRequestStatus,
  Prisma,
} from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestCodeService } from '../../common/services/request-code.service';
import { AuditService } from '../audit/audit.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { CreateLeavePolicyDto } from './dto/create-leave-policy.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { LeaveActionDto } from './dto/leave-action.dto';
import { LeaveBalanceDto } from './dto/leave-balance.dto';
import { ListLeaveRequestsDto } from './dto/list-leave-requests.dto';

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly approvalsService: ApprovalsService,
    private readonly requestCodeService: RequestCodeService,
  ) {}

  async createLeaveType(tenantId: string, actor: Express.User, dto: CreateLeaveTypeDto) {
    this.assertNotEndUser(actor);

    const created = await this.prisma.leaveType.create({
      data: {
        tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'LEAVE_TYPE_CREATE',
      entityType: 'LeaveType',
      entityId: created.id,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return created;
  }

  async listLeaveTypes(tenantId: string) {
    return this.prisma.leaveType.findMany({
      where: { tenantId },
      include: {
        policies: true,
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createLeavePolicy(
    tenantId: string,
    actor: Express.User,
    dto: CreateLeavePolicyDto,
  ) {
    this.assertNotEndUser(actor);

    const leaveType = await this.prisma.leaveType.findFirst({
      where: {
        tenantId,
        id: dto.leaveTypeId,
      },
      select: { id: true },
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    const policy = await this.prisma.leavePolicy.upsert({
      where: {
        tenantId_leaveTypeId: {
          tenantId,
          leaveTypeId: dto.leaveTypeId,
        },
      },
      create: {
        tenantId,
        leaveTypeId: dto.leaveTypeId,
        defaultAnnualQuota: new Prisma.Decimal(dto.defaultAnnualQuota),
        monthlyAccrual: new Prisma.Decimal(dto.monthlyAccrual),
        joiningProration: dto.joiningProration ?? true,
      },
      update: {
        defaultAnnualQuota: new Prisma.Decimal(dto.defaultAnnualQuota),
        monthlyAccrual: new Prisma.Decimal(dto.monthlyAccrual),
        joiningProration: dto.joiningProration ?? true,
      },
    });

    if (dto.userOverrides && dto.userOverrides.length > 0) {
      for (const override of dto.userOverrides) {
        await this.prisma.leaveUserQuotaOverride.upsert({
          where: {
            tenantId_userId_leaveTypeId: {
              tenantId,
              userId: override.userId,
              leaveTypeId: dto.leaveTypeId,
            },
          },
          create: {
            tenantId,
            userId: override.userId,
            leaveTypeId: dto.leaveTypeId,
            annualQuota: new Prisma.Decimal(override.annualQuota),
            monthlyAccrual:
              override.monthlyAccrual !== undefined
                ? new Prisma.Decimal(override.monthlyAccrual)
                : null,
          },
          update: {
            annualQuota: new Prisma.Decimal(override.annualQuota),
            monthlyAccrual:
              override.monthlyAccrual !== undefined
                ? new Prisma.Decimal(override.monthlyAccrual)
                : null,
          },
        });
      }
    }

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'LEAVE_POLICY_UPSERT',
      entityType: 'LeavePolicy',
      entityId: policy.id,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return policy;
  }

  async getMyBalance(tenantId: string, actor: Express.User, query: LeaveBalanceDto) {
    return this.getBalance(tenantId, actor, actor.sub, query);
  }

  async getBalance(
    tenantId: string,
    actor: Express.User,
    targetUserId: string,
    query: LeaveBalanceDto,
  ) {
    await this.assertUserBalanceAccess(tenantId, actor, targetUserId);

    const year = query.year ?? new Date().getUTCFullYear();
    await this.ensureAccrualLedgerForYear(tenantId, targetUserId, year);

    const leaveTypes = await this.prisma.leaveType.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      include: {
        policies: {
          where: { tenantId },
          take: 1,
        },
        overrides: {
          where: {
            tenantId,
            userId: targetUserId,
          },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });

    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const balances: Array<{
      leaveTypeId: string;
      code: string;
      name: string;
      annualQuota: number;
      accrued: number;
      usedApproved: number;
      usedPending: number;
      available: number;
    }> = [];

    for (const leaveType of leaveTypes) {
      const policy = leaveType.policies[0];
      if (!policy) {
        continue;
      }

      const override = leaveType.overrides[0];

      const accruedAgg = await this.prisma.leaveAccrualLedger.aggregate({
        where: {
          tenantId,
          userId: targetUserId,
          leaveTypeId: leaveType.id,
          year,
        },
        _sum: {
          amount: true,
        },
      });

      const approvedAgg = await this.prisma.leaveRequest.aggregate({
        where: {
          tenantId,
          userId: targetUserId,
          leaveTypeId: leaveType.id,
          status: LeaveRequestStatus.APPROVED,
          startDate: { lte: yearEnd },
          endDate: { gte: yearStart },
        },
        _sum: {
          totalDays: true,
        },
      });

      const pendingAgg = await this.prisma.leaveRequest.aggregate({
        where: {
          tenantId,
          userId: targetUserId,
          leaveTypeId: leaveType.id,
          status: LeaveRequestStatus.PENDING,
          startDate: { lte: yearEnd },
          endDate: { gte: yearStart },
        },
        _sum: {
          totalDays: true,
        },
      });

      const annualQuota = Number(override?.annualQuota ?? policy.defaultAnnualQuota);
      const accrued = Number(accruedAgg._sum.amount ?? 0);
      const usedApproved = Number(approvedAgg._sum.totalDays ?? 0);
      const usedPending = Number(pendingAgg._sum.totalDays ?? 0);
      const available = accrued - usedApproved;

      balances.push({
        leaveTypeId: leaveType.id,
        code: leaveType.code,
        name: leaveType.name,
        annualQuota: Number(annualQuota.toFixed(2)),
        accrued: Number(accrued.toFixed(2)),
        usedApproved: Number(usedApproved.toFixed(2)),
        usedPending: Number(usedPending.toFixed(2)),
        available: Number(available.toFixed(2)),
      });
    }

    return {
      userId: targetUserId,
      year,
      balances,
    };
  }

  async createLeaveRequest(
    tenantId: string,
    actor: Express.User,
    dto: CreateLeaveRequestDto,
  ) {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('endDate must be greater than or equal to startDate');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        id: actor.sub,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const leaveType = await this.prisma.leaveType.findFirst({
      where: {
        tenantId,
        id: dto.leaveTypeId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    const leaveDays = this.calculateLeaveDays(dto.startDate, dto.endDate);
    const year = dto.startDate.getUTCFullYear();

    await this.ensureAccrualLedgerForYear(tenantId, actor.sub, year);

    const balance = await this.getBalance(tenantId, actor, actor.sub, { year });
    const selectedBalance = balance.balances.find((entry) => entry.leaveTypeId === dto.leaveTypeId);

    if (!selectedBalance) {
      throw new BadRequestException('No leave policy configured for leave type');
    }

    if (leaveDays > selectedBalance.available) {
      throw new BadRequestException(
        `Insufficient leave balance. Available: ${selectedBalance.available}`,
      );
    }

    const conflicts = await this.findTeamConflicts(
      tenantId,
      actor.sub,
      dto.startDate,
      dto.endDate,
    );

    const requestCode = await this.requestCodeService.next(tenantId, 'leave');

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        tenantId,
        requestCode,
        userId: actor.sub,
        leaveTypeId: dto.leaveTypeId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        totalDays: new Prisma.Decimal(leaveDays),
        reason: dto.reason,
        status: LeaveRequestStatus.PENDING,
        conflictMeta: {
          warnings: conflicts,
        },
      },
    });

    const approval = await this.approvalsService.createSingleStepApproval({
      tenantId,
      targetType: ApprovalTargetType.LEAVE_REQUEST,
      targetId: leaveRequest.id,
      requesterId: actor.sub,
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'LEAVE_REQUEST_CREATE',
      entityType: 'LeaveRequest',
      entityId: leaveRequest.id,
      metadata: {
        leaveDays,
        warnings: conflicts,
        approvalRequestId: approval.approvalRequestId,
      },
    });

    return {
      ...leaveRequest,
      conflictWarnings: conflicts,
      approvalRequestId: approval.approvalRequestId,
    };
  }

  async listLeaveRequests(
    tenantId: string,
    actor: Express.User,
    query: ListLeaveRequestsDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.LeaveRequestWhereInput = {
      tenantId,
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            startDate: {
              gte: query.from,
              lte: query.to,
            },
          }
        : {}),
    };

    if (this.isEndUser(actor)) {
      where.userId = actor.sub;
    }

    if (this.isTeamLead(actor)) {
      const leadTeamIds = await this.getLeadTeamIds(tenantId, actor.sub);
      where.OR = [
        {
          user: {
            teamMembership: {
              some: {
                tenantId,
                teamId: { in: leadTeamIds },
              },
            },
          },
        },
        { userId: actor.sub },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.leaveRequest.count({ where }),
      this.prisma.leaveRequest.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
          leaveType: {
            select: { id: true, code: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items,
      page,
      limit,
      total,
    };
  }

  async approveLeaveRequest(
    tenantId: string,
    actor: Express.User,
    leaveRequestId: string,
    dto: LeaveActionDto,
  ) {
    const approval = await this.approvalsService.getByTarget(
      tenantId,
      ApprovalTargetType.LEAVE_REQUEST,
      leaveRequestId,
    );

    if (!approval) {
      throw new NotFoundException('Approval request not found for leave request');
    }

    return this.approvalsService.approve(tenantId, actor, approval.id, {
      reason: dto.reason,
    });
  }

  async rejectLeaveRequest(
    tenantId: string,
    actor: Express.User,
    leaveRequestId: string,
    dto: LeaveActionDto,
  ) {
    const approval = await this.approvalsService.getByTarget(
      tenantId,
      ApprovalTargetType.LEAVE_REQUEST,
      leaveRequestId,
    );

    if (!approval) {
      throw new NotFoundException('Approval request not found for leave request');
    }

    return this.approvalsService.reject(tenantId, actor, approval.id, {
      reason: dto.reason,
    });
  }

  private async ensureAccrualLedgerForYear(
    tenantId: string,
    userId: string,
    year: number,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        id: userId,
        deletedAt: null,
      },
      select: { createdAt: true },
    });

    if (!user) {
      throw new NotFoundException('User not found for accrual calculation');
    }

    const policies = await this.prisma.leavePolicy.findMany({
      where: { tenantId },
      include: {
        leaveType: {
          select: { id: true, isActive: true },
        },
        tenant: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (policies.length === 0) {
      return;
    }

    const overrides = await this.prisma.leaveUserQuotaOverride.findMany({
      where: {
        tenantId,
        userId,
      },
      select: {
        leaveTypeId: true,
        monthlyAccrual: true,
      },
    });

    const overrideByType = new Map(overrides.map((entry) => [entry.leaveTypeId, entry]));

    const joinYear = user.createdAt.getUTCFullYear();
    const joinMonth = user.createdAt.getUTCMonth() + 1;
    const joinDate = user.createdAt.getUTCDate();

    const now = new Date();
    const maxMonth =
      year < now.getUTCFullYear()
        ? 12
        : year > now.getUTCFullYear()
          ? 0
          : now.getUTCMonth() + 1;

    for (const policy of policies) {
      if (!policy.leaveType.isActive) {
        continue;
      }

      const override = overrideByType.get(policy.leaveTypeId);
      const monthlyAccrual = Number(override?.monthlyAccrual ?? policy.monthlyAccrual);

      if (monthlyAccrual <= 0 || year < joinYear) {
        continue;
      }

      for (let month = 1; month <= maxMonth; month += 1) {
        let amount = monthlyAccrual;

        if (
          policy.joiningProration &&
          year === joinYear &&
          month === joinMonth
        ) {
          const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
          const daysWorked = daysInMonth - joinDate + 1;
          const ratio = Math.max(0, Math.min(1, daysWorked / daysInMonth));
          amount = monthlyAccrual * ratio;
        }

        if (year === joinYear && month < joinMonth) {
          amount = 0;
        }

        await this.prisma.leaveAccrualLedger.upsert({
          where: {
            tenantId_userId_leaveTypeId_year_month: {
              tenantId,
              userId,
              leaveTypeId: policy.leaveTypeId,
              year,
              month,
            },
          },
          create: {
            tenantId,
            userId,
            leaveTypeId: policy.leaveTypeId,
            year,
            month,
            amount: new Prisma.Decimal(Number(amount.toFixed(4))),
            note: 'Monthly accrual',
          },
          update: {
            amount: new Prisma.Decimal(Number(amount.toFixed(4))),
          },
        });
      }
    }
  }

  private calculateLeaveDays(startDate: Date, endDate: Date): number {
    const start = Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
    );
    const end = Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
    );

    const diffDays = Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;

    if (diffDays <= 0) {
      throw new BadRequestException('Invalid leave date range');
    }

    return diffDays;
  }

  private async findTeamConflicts(
    tenantId: string,
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ userId: string; startDate: Date; endDate: Date; status: string }>> {
    const memberships = await this.prisma.teamMember.findMany({
      where: {
        tenantId,
        userId,
      },
      select: { teamId: true },
    });

    const teamIds = memberships.map((entry) => entry.teamId);

    if (teamIds.length === 0) {
      return [];
    }

    const conflicts = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        userId: { not: userId },
        status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        user: {
          teamMembership: {
            some: {
              tenantId,
              teamId: { in: teamIds },
            },
          },
        },
      },
      select: {
        userId: true,
        startDate: true,
        endDate: true,
        status: true,
      },
      orderBy: { startDate: 'asc' },
      take: 20,
    });

    return conflicts.map((entry) => ({
      userId: entry.userId,
      startDate: entry.startDate,
      endDate: entry.endDate,
      status: entry.status,
    }));
  }

  private async assertUserBalanceAccess(
    tenantId: string,
    actor: Express.User,
    targetUserId: string,
  ): Promise<void> {
    if (targetUserId === actor.sub || this.isSuperAdmin(actor)) {
      return;
    }

    if (this.isEndUser(actor)) {
      throw new ForbiddenException('USER can only access own leave balance');
    }

    const [actorTeams, targetTeams] = await Promise.all([
      this.prisma.teamMember.findMany({
        where: { tenantId, userId: actor.sub },
        select: { teamId: true },
      }),
      this.prisma.teamMember.findMany({
        where: { tenantId, userId: targetUserId },
        select: { teamId: true },
      }),
    ]);

    const targetSet = new Set(targetTeams.map((entry) => entry.teamId));
    const overlap = actorTeams.some((entry) => targetSet.has(entry.teamId));

    if (!overlap) {
      throw new ForbiddenException('TEAM_LEAD can only access team member balances');
    }
  }

  private assertNotEndUser(actor: Express.User): void {
    if (this.isEndUser(actor)) {
      throw new ForbiddenException('USER cannot perform this action');
    }
  }

  private isSuperAdmin(actor: Express.User): boolean {
    return actor.roles.includes(Role.SUPER_ADMIN);
  }

  private isTeamLead(actor: Express.User): boolean {
    return !this.isSuperAdmin(actor) && actor.roles.includes(Role.TEAM_LEAD);
  }

  private isEndUser(actor: Express.User): boolean {
    return !this.isSuperAdmin(actor) && !this.isTeamLead(actor);
  }

  private async getLeadTeamIds(tenantId: string, userId: string): Promise<string[]> {
    const rows = await this.prisma.teamMember.findMany({
      where: {
        tenantId,
        userId,
      },
      select: { teamId: true },
    });

    return rows.map((entry) => entry.teamId);
  }
}
