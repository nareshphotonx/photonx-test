import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validateSync } from 'class-validator';
import { TimeEntrySource } from '@prisma/client';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { ExpensesService } from '../expenses/expenses.service';
import { LeaveService } from '../leave/leave.service';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { TimeEntriesService } from '../time-entries/time-entries.service';
import { WfhService } from '../wfh/wfh.service';
import {
  ApplyLeaveToolInput,
  ApplyWfhToolInput,
  CheckInToolInput,
  CheckOutToolInput,
  FileExpenseToolInput,
  GetProjectBurnToolInput,
  GetUserLeaveBalanceToolInput,
  GetUserPerformanceToolInput,
  ListMyTasksToolInput,
  ListPendingApprovalsToolInput,
  LogTaskHoursToolInput,
  UpdateTaskStatusToolInput,
  WhoIsOnLeaveTodayToolInput,
} from './dto/tool-inputs.dto';

export interface ExecutedToolCall {
  toolName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  numericEvidence: number[];
  success: boolean;
  error?: string;
  durationMs: number;
}

@Injectable()
export class AiToolExecutorService {
  constructor(
    private readonly leaveService: LeaveService,
    private readonly wfhService: WfhService,
    private readonly tasksService: TasksService,
    private readonly timeEntriesService: TimeEntriesService,
    private readonly projectsService: ProjectsService,
    private readonly approvalsService: ApprovalsService,
    private readonly expensesService: ExpensesService,
    private readonly attendanceService: AttendanceService,
    private readonly prisma: PrismaService,
    private readonly scopeService: TenantRbacScopeService,
  ) {}

  async execute(
    tenantId: string,
    actor: Express.User,
    toolName: string,
    payload: Record<string, unknown>,
  ): Promise<ExecutedToolCall> {
    const startedAt = Date.now();

    try {
      const output = await this.runTool(tenantId, actor, toolName, payload);
      const numericEvidence = this.extractNumbers(output);

      return {
        toolName,
        input: payload,
        output,
        numericEvidence,
        success: true,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        toolName,
        input: payload,
        output: {},
        numericEvidence: [],
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
        durationMs: Date.now() - startedAt,
      };
    }
  }

  private async runTool(
    tenantId: string,
    actor: Express.User,
    toolName: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (toolName === 'get_user_leave_balance') {
      const input = this.validateInput(GetUserLeaveBalanceToolInput, payload);
      const requestedUserId = input.userId ?? actor.sub;
      this.assertPermission(
        actor,
        requestedUserId === actor.sub
          ? PERMISSIONS.LEAVE_BALANCE_ME_READ
          : PERMISSIONS.LEAVE_BALANCE_USER_READ,
      );
      if (requestedUserId !== actor.sub && this.scopeService.isEndUser(actor)) {
        throw new ForbiddenException('USER can only access own leave balance');
      }

      const result = await this.leaveService.getBalance(
        tenantId,
        actor,
        requestedUserId,
        { year: input.year },
      );

      return result as unknown as Record<string, unknown>;
    }

    if (toolName === 'apply_leave') {
      this.assertPermission(actor, PERMISSIONS.LEAVE_REQUESTS_CREATE);
      const input = this.validateInput(ApplyLeaveToolInput, payload);
      const result = await this.leaveService.createLeaveRequest(tenantId, actor, {
        leaveTypeId: input.leaveTypeId,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason,
      });
      return result as unknown as Record<string, unknown>;
    }

    if (toolName === 'apply_wfh') {
      this.assertPermission(actor, PERMISSIONS.WFH_REQUESTS_CREATE);
      const input = this.validateInput(ApplyWfhToolInput, payload);
      const result = await this.wfhService.createRequest(tenantId, actor, {
        requestDate: input.requestDate,
        reason: input.reason,
      });
      return result as unknown as Record<string, unknown>;
    }

    if (toolName === 'list_my_tasks') {
      this.assertPermission(actor, PERMISSIONS.TASKS_READ);
      const input = this.validateInput(ListMyTasksToolInput, payload);
      const result = await this.tasksService.listTasks(tenantId, actor, {
        assigneeId: actor.sub,
        projectId: input.projectId,
        statusId: input.statusId,
        page: 1,
        limit: input.limit ?? 20,
      });
      return result as unknown as Record<string, unknown>;
    }

    if (toolName === 'update_task_status') {
      this.assertPermission(actor, PERMISSIONS.TASKS_STATUS_UPDATE);
      const input = this.validateInput(UpdateTaskStatusToolInput, payload);
      const result = await this.tasksService.changeStatus(
        tenantId,
        actor,
        input.taskId,
        {
          statusId: input.statusId,
          locationLatitude: input.locationLatitude,
          locationLongitude: input.locationLongitude,
          selfieAttachmentId: input.selfieAttachmentId,
        },
      );
      return result as unknown as Record<string, unknown>;
    }

    if (toolName === 'log_task_hours') {
      this.assertPermission(actor, PERMISSIONS.TIME_ENTRIES_CREATE);
      const input = this.validateInput(LogTaskHoursToolInput, payload);
      const result = await this.timeEntriesService.createTimeEntry(tenantId, actor, {
        projectId: input.projectId,
        taskId: input.taskId,
        entryDate: input.entryDate,
        hours: input.hours,
        source: TimeEntrySource.MANUAL,
        note: input.note,
      });
      return result as unknown as Record<string, unknown>;
    }

    if (toolName === 'get_user_performance') {
      this.assertPermission(actor, PERMISSIONS.TIME_ENTRIES_READ);
      const input = this.validateInput(GetUserPerformanceToolInput, payload);
      const targetUserId = input.userId ?? actor.sub;

      if (targetUserId !== actor.sub && this.scopeService.isEndUser(actor)) {
        throw new ForbiddenException('USER can only access own performance');
      }

      if (targetUserId !== actor.sub && this.scopeService.isTeamLead(actor)) {
        const leadTeamIds = await this.scopeService.getLeadTeamIds(tenantId, actor.sub);
        const hasOverlap = await this.prisma.teamMember.findFirst({
          where: {
            tenantId,
            userId: targetUserId,
            teamId: { in: leadTeamIds },
          },
        });

        if (!hasOverlap) {
          throw new ForbiddenException('TEAM_LEAD can only access own team members');
        }
      }

      const days = input.days ?? 7;
      const fromDate = new Date();
      fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1));
      fromDate.setUTCHours(0, 0, 0, 0);

      const [completedTasks, totalHours, attendanceAgg, blockers] = await Promise.all([
        this.prisma.task.count({
          where: {
            tenantId,
            assigneeId: targetUserId,
            deletedAt: null,
            updatedAt: { gte: fromDate },
            status: { isDone: true },
          },
        }),
        this.prisma.timeEntry.aggregate({
          where: {
            tenantId,
            userId: targetUserId,
            entryDate: { gte: fromDate },
          },
          _sum: { hours: true },
        }),
        this.prisma.attendanceDay.aggregate({
          where: {
            tenantId,
            userId: targetUserId,
            date: { gte: fromDate },
          },
          _sum: {
            lateMinutes: true,
            earlyLogoutMinutes: true,
          },
        }),
        this.prisma.taskComment.count({
          where: {
            tenantId,
            authorId: targetUserId,
            content: { startsWith: 'BLOCKED:' },
            task: {
              deletedAt: null,
              status: { isDone: false },
            },
          },
        }),
      ]);

      return {
        userId: targetUserId,
        days,
        tasksCompleted: completedTasks,
        hoursLogged: Number(totalHours._sum.hours ?? 0),
        lateMinutes: attendanceAgg._sum.lateMinutes ?? 0,
        earlyLogoutMinutes: attendanceAgg._sum.earlyLogoutMinutes ?? 0,
        openBlockers: blockers,
      };
    }

    if (toolName === 'get_project_burn') {
      this.assertPermission(actor, PERMISSIONS.PROJECTS_BURN_READ);
      const input = this.validateInput(GetProjectBurnToolInput, payload);
      const result = await this.projectsService.getProjectBurn(
        tenantId,
        actor,
        input.projectId,
        {
          from: input.from,
          to: input.to,
        },
      );
      return result as unknown as Record<string, unknown>;
    }

    if (toolName === 'list_pending_approvals') {
      this.assertPermission(actor, PERMISSIONS.APPROVALS_PENDING_READ);
      if (this.scopeService.isEndUser(actor)) {
        throw new ForbiddenException('USER cannot list pending approvals');
      }

      const input = this.validateInput(ListPendingApprovalsToolInput, payload);
      const result = await this.approvalsService.listPending(tenantId, actor, {
        page: input.page,
        limit: input.limit,
      });
      return result as unknown as Record<string, unknown>;
    }

    if (toolName === 'who_is_on_leave_today') {
      this.assertPermission(actor, PERMISSIONS.LEAVE_REQUESTS_READ);
      const input = this.validateInput(WhoIsOnLeaveTodayToolInput, payload);
      const targetDate = input.date ?? new Date();
      const normalized = new Date(Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
      ));

      const whereBase = {
        tenantId,
        status: 'APPROVED' as const,
        startDate: { lte: normalized },
        endDate: { gte: normalized },
      };

      if (this.scopeService.isEndUser(actor)) {
        const own = await this.prisma.leaveRequest.findMany({
          where: {
            ...whereBase,
            userId: actor.sub,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            leaveType: { select: { code: true, name: true } },
          },
        });

        return {
          date: normalized,
          items: own,
        } as unknown as Record<string, unknown>;
      }

      if (this.scopeService.isTeamLead(actor)) {
        const leadTeamIds = await this.scopeService.getLeadTeamIds(tenantId, actor.sub);
        const items = await this.prisma.leaveRequest.findMany({
          where: {
            ...whereBase,
            user: {
              teamMembership: {
                some: {
                  tenantId,
                  teamId: { in: leadTeamIds },
                },
              },
            },
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            leaveType: { select: { code: true, name: true } },
          },
        });

        return {
          date: normalized,
          items,
        } as unknown as Record<string, unknown>;
      }

      const all = await this.prisma.leaveRequest.findMany({
        where: whereBase,
        include: {
          user: { select: { id: true, name: true, email: true } },
          leaveType: { select: { code: true, name: true } },
        },
      });

      return {
        date: normalized,
        items: all,
      } as unknown as Record<string, unknown>;
    }

    if (toolName === 'file_expense') {
      this.assertPermission(actor, PERMISSIONS.EXPENSES_CREATE);
      const input = this.validateInput(FileExpenseToolInput, payload);
      const result = await this.expensesService.createExpense(tenantId, actor, {
        projectId: input.projectId,
        categoryId: input.categoryId,
        amount: input.amount,
        currency: input.currency,
        expenseDate: input.expenseDate,
        description: input.description,
        receiptAttachmentId: input.receiptAttachmentId,
      });
      return result as unknown as Record<string, unknown>;
    }

    if (toolName === 'check_in') {
      this.assertPermission(actor, PERMISSIONS.ATTENDANCE_CHECK_IN);
      const input = this.validateInput(CheckInToolInput, payload);
      const result = await this.attendanceService.checkIn(tenantId, actor, undefined, {
        occurredAt: input.occurredAt,
        latitude: input.latitude,
        longitude: input.longitude,
        reason: input.reason,
      });
      return result as unknown as Record<string, unknown>;
    }

    if (toolName === 'check_out') {
      this.assertPermission(actor, PERMISSIONS.ATTENDANCE_CHECK_OUT);
      const input = this.validateInput(CheckOutToolInput, payload);
      const result = await this.attendanceService.checkOut(tenantId, actor, undefined, {
        occurredAt: input.occurredAt,
        latitude: input.latitude,
        longitude: input.longitude,
      });
      return result as unknown as Record<string, unknown>;
    }

    throw new BadRequestException(`Unknown tool: ${toolName}`);
  }

  private validateInput<T extends object>(
    dtoClass: ClassConstructor<T>,
    payload: Record<string, unknown>,
  ): T {
    const transformed = plainToInstance(dtoClass, payload, {
      enableImplicitConversion: true,
      exposeDefaultValues: true,
    });

    const errors = validateSync(transformed, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const messages = errors.flatMap((entry) =>
        Object.values(entry.constraints ?? {}),
      );
      throw new BadRequestException(
        messages.length > 0
          ? messages.join(', ')
          : `Invalid input for tool ${dtoClass.name}`,
      );
    }

    return transformed;
  }

  private extractNumbers(value: unknown): number[] {
    const numbers: number[] = [];

    const visit = (candidate: unknown): void => {
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        numbers.push(candidate);
        return;
      }

      if (Array.isArray(candidate)) {
        for (const item of candidate) {
          visit(item);
        }
        return;
      }

      if (candidate && typeof candidate === 'object') {
        for (const item of Object.values(candidate)) {
          visit(item);
        }
      }
    };

    visit(value);
    return numbers;
  }

  private assertPermission(actor: Express.User, permission: string): void {
    const permissions = actor.permissions ?? [];
    if (!permissions.includes(permission)) {
      throw new ForbiddenException(`Permission ${permission} is required`);
    }
  }
}
