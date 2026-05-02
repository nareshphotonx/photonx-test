import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  ApprovalTargetType,
  AttendanceDayStatus,
  AttendanceEventType,
  ExpenseStatus,
  LeaveRequestStatus,
  Prisma,
  WfhRequestStatus,
} from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActApprovalDto } from './dto/act-approval.dto';
import { ListApprovalsDto } from './dto/list-approvals.dto';

interface CreateApprovalInput {
  tenantId: string;
  targetType: ApprovalTargetType;
  targetId: string;
  requesterId: string;
}

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createSingleStepApproval(input: CreateApprovalInput): Promise<{
    approvalRequestId: string;
    currentStep: number;
    status: ApprovalStatus;
    approverId: string;
  }> {
    const approverId = await this.resolveApproverId(
      input.tenantId,
      input.requesterId,
    );

    const existing = await this.prisma.approvalRequest.findUnique({
      where: {
        tenantId_targetType_targetId: {
          tenantId: input.tenantId,
          targetType: input.targetType,
          targetId: input.targetId,
        },
      },
      select: {
        id: true,
        status: true,
        currentStep: true,
        steps: {
          where: { stepOrder: 1 },
          select: { approverId: true },
          take: 1,
        },
      },
    });

    if (existing) {
      return {
        approvalRequestId: existing.id,
        currentStep: existing.currentStep,
        status: existing.status,
        approverId: existing.steps[0]?.approverId ?? approverId,
      };
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const request = await tx.approvalRequest.create({
        data: {
          tenantId: input.tenantId,
          targetType: input.targetType,
          targetId: input.targetId,
          requesterId: input.requesterId,
          status: ApprovalStatus.PENDING,
          currentStep: 1,
        },
      });

      await tx.approvalStep.create({
        data: {
          tenantId: input.tenantId,
          approvalRequestId: request.id,
          stepOrder: 1,
          approverId,
          status: ApprovalStatus.PENDING,
        },
      });

      return request;
    });

    await this.auditService.log({
      tenantId: input.tenantId,
      actorId: input.requesterId,
      action: 'APPROVAL_REQUEST_CREATE',
      entityType: 'ApprovalRequest',
      entityId: created.id,
      metadata: {
        targetType: input.targetType,
        targetId: input.targetId,
        approverId,
      },
    });

    return {
      approvalRequestId: created.id,
      currentStep: 1,
      status: created.status,
      approverId,
    };
  }

  async approve(
    tenantId: string,
    actor: Express.User,
    approvalRequestId: string,
    dto: ActApprovalDto,
  ) {
    return this.actOnApproval(tenantId, actor, approvalRequestId, 'APPROVE', dto);
  }

  async reject(
    tenantId: string,
    actor: Express.User,
    approvalRequestId: string,
    dto: ActApprovalDto,
  ) {
    return this.actOnApproval(tenantId, actor, approvalRequestId, 'REJECT', dto);
  }

  async listPending(tenantId: string, actor: Express.User, query: ListApprovalsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ApprovalRequestWhereInput = {
      tenantId,
      status: ApprovalStatus.PENDING,
      steps: {
        some: {
          stepOrder: 1,
          status: ApprovalStatus.PENDING,
          ...(this.isSuperAdmin(actor) ? {} : { approverId: actor.sub }),
        },
      },
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.approvalRequest.count({ where }),
      this.prisma.approvalRequest.findMany({
        where,
        include: {
          requester: {
            select: { id: true, name: true, email: true, phone: true },
          },
          steps: {
            orderBy: { stepOrder: 'asc' },
            take: 1,
            select: {
              id: true,
              approverId: true,
              status: true,
              stepOrder: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows,
      page,
      limit,
      total,
    };
  }

  async listHistory(tenantId: string, actor: Express.User, query: ListApprovalsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ApprovalRequestWhereInput = {
      tenantId,
      status: { not: ApprovalStatus.PENDING },
      ...(this.isSuperAdmin(actor)
        ? {}
        : {
            OR: [
              { requesterId: actor.sub },
              {
                steps: {
                  some: {
                    actedById: actor.sub,
                  },
                },
              },
            ],
          }),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.approvalRequest.count({ where }),
      this.prisma.approvalRequest.findMany({
        where,
        include: {
          requester: {
            select: { id: true, name: true, email: true, phone: true },
          },
          steps: {
            orderBy: { stepOrder: 'asc' },
            select: {
              id: true,
              approverId: true,
              actedById: true,
              status: true,
              reason: true,
              actedAt: true,
              stepOrder: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows,
      page,
      limit,
      total,
    };
  }

  async getByTarget(
    tenantId: string,
    targetType: ApprovalTargetType,
    targetId: string,
  ) {
    return this.prisma.approvalRequest.findUnique({
      where: {
        tenantId_targetType_targetId: {
          tenantId,
          targetType,
          targetId,
        },
      },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    });
  }

  private async actOnApproval(
    tenantId: string,
    actor: Express.User,
    approvalRequestId: string,
    action: 'APPROVE' | 'REJECT',
    dto: ActApprovalDto,
  ) {
    const request = await this.prisma.approvalRequest.findFirst({
      where: {
        tenantId,
        id: approvalRequestId,
      },
      include: {
        steps: {
          where: {
            stepOrder: 1,
          },
          take: 1,
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Approval request not found');
    }

    if (request.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Approval request already completed');
    }

    const step = request.steps[0];
    if (!step || step.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('No pending approval step found');
    }

    if (request.requesterId === actor.sub) {
      throw new ForbiddenException('Self-approval is not allowed');
    }

    if (!this.isSuperAdmin(actor)) {
      if (step.approverId !== actor.sub) {
        throw new ForbiddenException('Approval not assigned to current user');
      }

      if (this.isTeamLead(actor)) {
        await this.assertTeamOverlap(tenantId, actor.sub, request.requesterId);
      } else {
        throw new ForbiddenException('Insufficient approval privileges');
      }
    }

    const nextStatus = action === 'APPROVE' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.approvalStep.update({
        where: { id: step.id },
        data: {
          status: nextStatus,
          actedAt: new Date(),
          actedById: actor.sub,
          reason: dto.reason,
        },
      });

      const updatedRequest = await tx.approvalRequest.update({
        where: { id: request.id },
        data: {
          status: nextStatus,
          resolvedAt: new Date(),
          currentStep: 1,
        },
      });

      await this.applyTargetDecision(
        tx,
        tenantId,
        request.targetType,
        request.targetId,
        action,
        actor.sub,
        dto.reason,
      );

      return updatedRequest;
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: `APPROVAL_${action}`,
      entityType: 'ApprovalRequest',
      entityId: request.id,
      metadata: {
        targetType: request.targetType,
        targetId: request.targetId,
        reason: dto.reason,
      },
    });

    return {
      approvalRequestId: result.id,
      status: result.status,
      currentStep: result.currentStep,
      actedBy: actor.sub,
      actedAt: result.resolvedAt,
    };
  }

  private async applyTargetDecision(
    tx: Prisma.TransactionClient,
    tenantId: string,
    targetType: ApprovalTargetType,
    targetId: string,
    action: 'APPROVE' | 'REJECT',
    actorId: string,
    reason?: string,
  ): Promise<void> {
    const isApprove = action === 'APPROVE';

    if (targetType === ApprovalTargetType.ATTENDANCE_REGULARIZATION) {
      const regularization = await tx.attendanceRegularizationRequest.findFirst({
        where: { tenantId, id: targetId },
      });

      if (!regularization) {
        throw new NotFoundException('Regularization request not found');
      }

      await tx.attendanceRegularizationRequest.update({
        where: { id: regularization.id },
        data: {
          status: isApprove ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
          actedById: actorId,
          actedAt: new Date(),
          actionReason: reason,
        },
      });

      if (isApprove) {
        const attendanceDay = await tx.attendanceDay.findFirst({
          where: {
            tenantId,
            id: regularization.attendanceDayId,
          },
          select: { id: true, date: true, userId: true },
        });

        if (!attendanceDay) {
          throw new NotFoundException('Attendance day not found');
        }

        const settings = await tx.tenantSetting.findUnique({
          where: { tenantId },
          select: { extras: true },
        });

        const policy = this.resolveOfficePolicy(settings?.extras ?? null);
        const lateMinutes = this.calculateLateMinutes(
          regularization.correctedCheckInAt,
          policy.officeStartTime,
        );
        const earlyLogoutMinutes = this.calculateEarlyLogoutMinutes(
          regularization.correctedCheckOutAt,
          policy.officeEndTime,
        );

        await tx.attendanceDay.update({
          where: { id: attendanceDay.id },
          data: {
            checkInAt: regularization.correctedCheckInAt,
            checkOutAt: regularization.correctedCheckOutAt,
            lateMinutes,
            earlyLogoutMinutes,
            isMissingCheckout: false,
            status: AttendanceDayStatus.REGULARIZED,
          },
        });

        await tx.attendanceEvent.create({
          data: {
            tenantId,
            userId: attendanceDay.userId,
            attendanceDayId: attendanceDay.id,
            type: AttendanceEventType.CORRECTION,
            occurredAt: new Date(),
            reason: reason ?? regularization.reason,
          },
        });
      }

      return;
    }

    if (targetType === ApprovalTargetType.LEAVE_REQUEST) {
      await tx.leaveRequest.update({
        where: { id: targetId },
        data: {
          status: isApprove ? LeaveRequestStatus.APPROVED : LeaveRequestStatus.REJECTED,
          actedById: actorId,
          actedAt: new Date(),
          actionReason: reason,
        },
      });

      return;
    }

    if (targetType === ApprovalTargetType.WFH_REQUEST) {
      await tx.wfhRequest.update({
        where: { id: targetId },
        data: {
          status: isApprove ? WfhRequestStatus.APPROVED : WfhRequestStatus.REJECTED,
          actedById: actorId,
          actedAt: new Date(),
          actionReason: reason,
        },
      });

      return;
    }

    if (targetType === ApprovalTargetType.EXPENSE) {
      const expense = await tx.expense.findFirst({
        where: {
          tenantId,
          id: targetId,
        },
      });

      if (!expense) {
        throw new NotFoundException('Expense not found');
      }

      if (!isApprove) {
        await tx.expense.update({
          where: { id: expense.id },
          data: {
            status: ExpenseStatus.REJECTED,
            actedById: actorId,
            actedAt: new Date(),
            actionReason: reason,
          },
        });
        return;
      }

      let projectCostId = expense.approvedProjectCostId;

      if (!projectCostId) {
        const createdProjectCost = await tx.projectCost.create({
          data: {
            tenantId,
            projectId: expense.projectId,
            amount: expense.amount,
            currency: expense.currency,
            category: `EXPENSE:${expense.categoryId}`,
            note: expense.description,
            costDate: expense.expenseDate,
            createdBy: expense.userId,
          },
        });

        projectCostId = createdProjectCost.id;
      }

      await tx.expense.update({
        where: { id: expense.id },
        data: {
          status: ExpenseStatus.APPROVED,
          actedById: actorId,
          actedAt: new Date(),
          actionReason: reason,
          approvedProjectCostId: projectCostId,
        },
      });
    }
  }

  private isSuperAdmin(actor: Express.User): boolean {
    return actor.roles.includes(Role.SUPER_ADMIN);
  }

  private isTeamLead(actor: Express.User): boolean {
    return !this.isSuperAdmin(actor) && actor.roles.includes(Role.TEAM_LEAD);
  }

  private async resolveApproverId(
    tenantId: string,
    requesterId: string,
  ): Promise<string> {
    const requesterTeams = await this.prisma.teamMember.findMany({
      where: {
        tenantId,
        userId: requesterId,
      },
      select: { teamId: true },
    });

    const requesterTeamIds = requesterTeams.map((entry) => entry.teamId);

    if (requesterTeamIds.length > 0) {
      const teammateRows = await this.prisma.teamMember.findMany({
        where: {
          tenantId,
          teamId: { in: requesterTeamIds },
          userId: { not: requesterId },
        },
        select: { userId: true },
      });

      const teammateIds = Array.from(new Set(teammateRows.map((entry) => entry.userId)));

      if (teammateIds.length > 0) {
        const leads = await this.prisma.userRole.findMany({
          where: {
            tenantId,
            userId: { in: teammateIds },
            role: { code: Role.TEAM_LEAD },
            user: {
              deletedAt: null,
              isActive: true,
            },
          },
          select: {
            userId: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        });

        const firstLead = leads.at(0);
        if (firstLead) {
          return firstLead.userId;
        }
      }
    }

    const superAdmin = await this.prisma.userRole.findFirst({
      where: {
        tenantId,
        role: { code: Role.SUPER_ADMIN },
        userId: { not: requesterId },
        user: {
          deletedAt: null,
          isActive: true,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        userId: true,
      },
    });

    if (!superAdmin) {
      throw new BadRequestException(
        'No eligible approver found (TEAM_LEAD or SUPER_ADMIN)',
      );
    }

    return superAdmin.userId;
  }

  private async assertTeamOverlap(
    tenantId: string,
    approverId: string,
    requesterId: string,
  ): Promise<void> {
    const [approverRows, requesterRows] = await Promise.all([
      this.prisma.teamMember.findMany({
        where: {
          tenantId,
          userId: approverId,
        },
        select: { teamId: true },
      }),
      this.prisma.teamMember.findMany({
        where: {
          tenantId,
          userId: requesterId,
        },
        select: { teamId: true },
      }),
    ]);

    const requesterTeamSet = new Set(requesterRows.map((entry) => entry.teamId));
    const overlap = approverRows.some((entry) => requesterTeamSet.has(entry.teamId));

    if (!overlap) {
      throw new ForbiddenException('TEAM_LEAD can only approve own team requests');
    }
  }

  private resolveOfficePolicy(extras: Prisma.JsonValue | null): {
    officeStartTime: string;
    officeEndTime: string;
  } {
    const objectExtras =
      extras && typeof extras === 'object' && !Array.isArray(extras)
        ? (extras as Record<string, unknown>)
        : {};

    const officeStartTime =
      typeof objectExtras.officeStartTime === 'string'
        ? objectExtras.officeStartTime
        : '09:30';

    const officeEndTime =
      typeof objectExtras.officeEndTime === 'string'
        ? objectExtras.officeEndTime
        : '18:30';

    return {
      officeStartTime,
      officeEndTime,
    };
  }

  private calculateLateMinutes(checkInAt: Date, officeStartTime: string): number {
    const [hours, minutes] = this.parseTime(officeStartTime);
    const start = new Date(checkInAt);
    start.setUTCHours(hours, minutes, 0, 0);

    const diffMs = checkInAt.getTime() - start.getTime();
    if (diffMs <= 0) {
      return 0;
    }

    return Math.floor(diffMs / (60 * 1000));
  }

  private calculateEarlyLogoutMinutes(
    checkOutAt: Date,
    officeEndTime: string,
  ): number {
    const [hours, minutes] = this.parseTime(officeEndTime);
    const end = new Date(checkOutAt);
    end.setUTCHours(hours, minutes, 0, 0);

    const diffMs = end.getTime() - checkOutAt.getTime();
    if (diffMs <= 0) {
      return 0;
    }

    return Math.floor(diffMs / (60 * 1000));
  }

  private parseTime(value: string): [number, number] {
    const [hoursRaw, minutesRaw] = value.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);

    if (
      !Number.isInteger(hours) ||
      !Number.isInteger(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return [9, 30];
    }

    return [hours, minutes];
  }
}
