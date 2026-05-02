import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalTargetType,
  Prisma,
  WfhRequestStatus,
} from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { CreateWfhPolicyDto } from './dto/create-wfh-policy.dto';
import { CreateWfhRequestDto } from './dto/create-wfh-request.dto';
import { ListWfhRequestsDto } from './dto/list-wfh-requests.dto';
import { WfhActionDto } from './dto/wfh-action.dto';
import { WfhBalanceDto } from './dto/wfh-balance.dto';

@Injectable()
export class WfhService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly approvalsService: ApprovalsService,
  ) {}

  async createPolicy(tenantId: string, actor: Express.User, dto: CreateWfhPolicyDto) {
    this.assertNotEndUser(actor);

    const policy = await this.prisma.wfhPolicy.upsert({
      where: { tenantId },
      create: {
        tenantId,
        defaultAnnualQuota: new Prisma.Decimal(dto.defaultAnnualQuota),
      },
      update: {
        defaultAnnualQuota: new Prisma.Decimal(dto.defaultAnnualQuota),
      },
    });

    if (dto.userOverrides && dto.userOverrides.length > 0) {
      for (const override of dto.userOverrides) {
        await this.prisma.wfhUserQuotaOverride.upsert({
          where: {
            tenantId_userId: {
              tenantId,
              userId: override.userId,
            },
          },
          create: {
            tenantId,
            userId: override.userId,
            annualQuota: new Prisma.Decimal(override.annualQuota),
          },
          update: {
            annualQuota: new Prisma.Decimal(override.annualQuota),
          },
        });
      }
    }

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'WFH_POLICY_UPSERT',
      entityType: 'WfhPolicy',
      entityId: policy.id,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return policy;
  }

  async getMyBalance(tenantId: string, actor: Express.User, query: WfhBalanceDto) {
    return this.getBalance(tenantId, actor, actor.sub, query);
  }

  async getBalance(
    tenantId: string,
    actor: Express.User,
    targetUserId: string,
    query: WfhBalanceDto,
  ) {
    await this.assertUserAccess(tenantId, actor, targetUserId);

    const year = query.year ?? new Date().getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const policy = await this.prisma.wfhPolicy.findUnique({
      where: { tenantId },
    });

    if (!policy) {
      throw new NotFoundException('WFH policy not configured');
    }

    const override = await this.prisma.wfhUserQuotaOverride.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId: targetUserId,
        },
      },
    });

    const annualQuota = Number(override?.annualQuota ?? policy.defaultAnnualQuota);

    const approvedCount = await this.prisma.wfhRequest.count({
      where: {
        tenantId,
        userId: targetUserId,
        status: WfhRequestStatus.APPROVED,
        requestDate: { gte: yearStart, lte: yearEnd },
      },
    });

    const pendingCount = await this.prisma.wfhRequest.count({
      where: {
        tenantId,
        userId: targetUserId,
        status: WfhRequestStatus.PENDING,
        requestDate: { gte: yearStart, lte: yearEnd },
      },
    });

    return {
      userId: targetUserId,
      year,
      annualQuota,
      usedApproved: approvedCount,
      usedPending: pendingCount,
      available: annualQuota - approvedCount,
    };
  }

  async createRequest(
    tenantId: string,
    actor: Express.User,
    dto: CreateWfhRequestDto,
  ) {
    const date = this.normalizeDateOnly(dto.requestDate);

    const balance = await this.getBalance(tenantId, actor, actor.sub, {
      year: date.getUTCFullYear(),
    });

    if (balance.available <= 0) {
      throw new BadRequestException('No remaining WFH quota available');
    }

    const conflictWarnings = await this.findTeamConflicts(tenantId, actor.sub, date);

    const request = await this.prisma.wfhRequest.create({
      data: {
        tenantId,
        userId: actor.sub,
        requestDate: date,
        reason: dto.reason,
        status: WfhRequestStatus.PENDING,
        conflictMeta: {
          warnings: conflictWarnings,
        },
      },
    });

    const approval = await this.approvalsService.createSingleStepApproval({
      tenantId,
      targetType: ApprovalTargetType.WFH_REQUEST,
      targetId: request.id,
      requesterId: actor.sub,
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'WFH_REQUEST_CREATE',
      entityType: 'WfhRequest',
      entityId: request.id,
      metadata: {
        warnings: conflictWarnings,
        approvalRequestId: approval.approvalRequestId,
      },
    });

    return {
      ...request,
      conflictWarnings,
      approvalRequestId: approval.approvalRequestId,
    };
  }

  async listRequests(tenantId: string, actor: Express.User, query: ListWfhRequestsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.WfhRequestWhereInput = {
      tenantId,
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            requestDate: {
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
      this.prisma.wfhRequest.count({ where }),
      this.prisma.wfhRequest.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
        orderBy: [{ requestDate: 'desc' }, { createdAt: 'desc' }],
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

  async approveRequest(
    tenantId: string,
    actor: Express.User,
    requestId: string,
    dto: WfhActionDto,
  ) {
    const approval = await this.approvalsService.getByTarget(
      tenantId,
      ApprovalTargetType.WFH_REQUEST,
      requestId,
    );

    if (!approval) {
      throw new NotFoundException('Approval request not found for WFH request');
    }

    return this.approvalsService.approve(tenantId, actor, approval.id, {
      reason: dto.reason,
    });
  }

  async rejectRequest(
    tenantId: string,
    actor: Express.User,
    requestId: string,
    dto: WfhActionDto,
  ) {
    const approval = await this.approvalsService.getByTarget(
      tenantId,
      ApprovalTargetType.WFH_REQUEST,
      requestId,
    );

    if (!approval) {
      throw new NotFoundException('Approval request not found for WFH request');
    }

    return this.approvalsService.reject(tenantId, actor, approval.id, {
      reason: dto.reason,
    });
  }

  private async findTeamConflicts(
    tenantId: string,
    userId: string,
    requestDate: Date,
  ): Promise<Array<{ userId: string; requestDate: Date; status: string }>> {
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

    const conflicts = await this.prisma.wfhRequest.findMany({
      where: {
        tenantId,
        userId: { not: userId },
        requestDate,
        status: { in: [WfhRequestStatus.PENDING, WfhRequestStatus.APPROVED] },
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
        requestDate: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    return conflicts.map((entry) => ({
      userId: entry.userId,
      requestDate: entry.requestDate,
      status: entry.status,
    }));
  }

  private async assertUserAccess(
    tenantId: string,
    actor: Express.User,
    targetUserId: string,
  ): Promise<void> {
    if (targetUserId === actor.sub || this.isSuperAdmin(actor)) {
      return;
    }

    if (this.isEndUser(actor)) {
      throw new ForbiddenException('USER can only access own WFH balance');
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

  private normalizeDateOnly(input: Date): Date {
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
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
