import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApprovalTargetType,
  IntegrationType,
  NotificationSource,
  Prisma,
  TimeEntrySource,
  WhatsAppMessageDirection,
  WhatsAppMessageStatus,
  WhatsAppMessageType,
  WhatsAppSessionState,
} from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ApprovalsService } from '../../approvals/approvals.service';
import { AttendanceService } from '../../attendance/attendance.service';
import { ExpensesService } from '../../expenses/expenses.service';
import { LeaveService } from '../../leave/leave.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { TimeEntriesService } from '../../time-entries/time-entries.service';
import { WfhService } from '../../wfh/wfh.service';
import { IntegrationSettingsService } from '../integration-settings.service';
import { ListWhatsappSessionsDto } from './dto/list-whatsapp-sessions.dto';
import { WhatsappSendTemplateDto } from './dto/whatsapp-send-template.dto';
import { WhatsappTestCommandDto } from './dto/whatsapp-test-command.dto';
import {
  ParsedWhatsappCommand,
  WhatsappCommandParserService,
} from './whatsapp-command-parser.service';

interface WhatsAppWebhookContext {
  tenantId: string;
  settingId: string;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
}

@Injectable()
export class WhatsappService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly settingsService: IntegrationSettingsService,
    private readonly parserService: WhatsappCommandParserService,
    private readonly attendanceService: AttendanceService,
    private readonly leaveService: LeaveService,
    private readonly wfhService: WfhService,
    private readonly expensesService: ExpensesService,
    private readonly timeEntriesService: TimeEntriesService,
    private readonly approvalsService: ApprovalsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async verifyWebhook(mode: string | undefined, token: string | undefined, challenge: string | undefined) {
    if (mode !== 'subscribe' || !token || !challenge) {
      throw new BadRequestException('Invalid WhatsApp verification query');
    }

    const settings = await this.prisma.integrationSetting.findMany({
      where: {
        type: IntegrationType.WHATSAPP,
        enabled: true,
      },
      select: {
        encryptedSecrets: true,
      },
    });

    const matched = settings.some((setting) => {
      const secrets = this.settingsService.readSecrets(setting.encryptedSecrets);
      return secrets.verifyToken === token;
    });

    if (!matched) {
      throw new UnauthorizedException('Invalid verify token');
    }

    return challenge;
  }

  async handleWebhook(payload: unknown) {
    const entries = this.readArray(payload, ['entry']);
    let processed = 0;

    for (const entry of entries) {
      const changes = this.readArray(entry, ['changes']);

      for (const change of changes) {
        const value = this.readObject(change, ['value']);
        const metadata = this.readObject(value, ['metadata']);
        const messages = this.readArray(value, ['messages']);

        if (messages.length === 0) {
          continue;
        }

        const phoneNumberId = this.readString(metadata, ['phone_number_id']);
        if (!phoneNumberId) {
          continue;
        }

        const ctx = await this.resolveTenantByPhoneNumberId(phoneNumberId);
        if (!ctx) {
          continue;
        }

        for (const message of messages) {
          await this.handleInboundMessage(ctx, message, value);
          processed += 1;
        }
      }
    }

    return {
      received: true,
      processed,
    };
  }

  async testCommand(dto: WhatsappTestCommandDto, providedSecret: string | undefined) {
    const expectedSecret = this.configService.get<string>('WHATSAPP_TEST_SECRET', 'change-me');

    if (!providedSecret || providedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid WhatsApp test secret');
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: {
        slug: dto.tenantSlug,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const user = dto.userPhone
      ? await this.findUserByPhone(tenant.id, dto.userPhone)
      : await this.prisma.user.findFirst({
          where: {
            tenantId: tenant.id,
            deletedAt: null,
            isActive: true,
          },
          orderBy: { createdAt: 'asc' },
        });

    if (!user) {
      throw new NotFoundException('No active user available for test-command');
    }

    const parsed = this.parserService.parse(dto.command);
    const actor = await this.buildActor(tenant.id, user.id);
    const result = await this.executeCommand(tenant.id, actor, parsed, {
      dryRun: true,
      sessionState: {},
    });

    return {
      parsed,
      result,
    };
  }

  async sendTemplate(tenantId: string, actorId: string, dto: WhatsappSendTemplateDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        id: dto.userId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        phone: true,
      },
    });

    if (!user || !user.phone) {
      throw new NotFoundException('User with phone not found');
    }

    const context = await this.getWhatsAppContextByTenantId(tenantId);
    if (!context) {
      throw new BadRequestException('WhatsApp integration is not configured for tenant');
    }

    const templateName = dto.templateName ?? String(context.config.utilityTemplateName ?? 'utility_notification');
    const response = await this.sendTemplateMessage(context, user.phone, templateName, dto.parameters ?? []);

    await this.prisma.whatsAppMessage.create({
      data: {
        tenantId,
        userId: user.id,
        waUserPhone: user.phone,
        direction: WhatsAppMessageDirection.OUTBOUND,
        messageType: WhatsAppMessageType.TEMPLATE,
        textBody: templateName,
        rawPayload: response.requestBody as Prisma.InputJsonValue,
        parsedCommand: Prisma.JsonNull,
        status: WhatsAppMessageStatus.SENT,
        providerMessageId: response.providerMessageId,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId,
      action: 'WHATSAPP_TEMPLATE_SEND',
      entityType: 'WhatsAppMessage',
      metadata: {
        userId: user.id,
        templateName,
      },
    });

    return {
      sent: true,
      providerMessageId: response.providerMessageId,
    };
  }

  async listSessions(tenantId: string, query: ListWhatsappSessionsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.whatsAppSession.count({ where: { tenantId } }),
      this.prisma.whatsAppSession.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      page,
      limit,
      total,
    };
  }

  async listMessages(tenantId: string, query: ListWhatsappSessionsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.whatsAppMessage.count({ where: { tenantId } }),
      this.prisma.whatsAppMessage.findMany({
        where: { tenantId },
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

  private async handleInboundMessage(
    context: WhatsAppWebhookContext,
    message: Record<string, unknown>,
    value: Record<string, unknown>,
  ) {
    const from = this.readString(message, ['from']);
    const type = this.readString(message, ['type']);

    if (!from || type !== 'text') {
      return;
    }

    const textBody = this.readString(message, ['text', 'body']);
    if (!textBody) {
      return;
    }

    const user = await this.findUserByPhone(context.tenantId, from);

    const inboundMessage = await this.prisma.whatsAppMessage.create({
      data: {
        tenantId: context.tenantId,
        userId: user?.id,
        waUserPhone: from,
        direction: WhatsAppMessageDirection.INBOUND,
        messageType: WhatsAppMessageType.TEXT,
        textBody,
        commandName: null,
        rawPayload: message as Prisma.InputJsonValue,
        parsedCommand: Prisma.JsonNull,
        status: WhatsAppMessageStatus.RECEIVED,
        providerMessageId: this.readString(message, ['id']),
      },
    });

    if (!user) {
      await this.prisma.whatsAppMessage.update({
        where: { id: inboundMessage.id },
        data: {
          status: WhatsAppMessageStatus.FAILED,
          errorMessage: 'No tenant user found for sender phone',
        },
      });
      return;
    }

    const actor = await this.buildActor(context.tenantId, user.id);
    const session = await this.upsertSession(context.tenantId, user.id, from);

    const taskRegex = await this.getTaskKeyRegex(context.tenantId);
    const parsed = this.parserService.parse(textBody, taskRegex);

    await this.prisma.whatsAppMessage.update({
      where: { id: inboundMessage.id },
      data: {
        commandName: parsed.name,
        parsedCommand: parsed as unknown as Prisma.InputJsonValue,
      },
    });

    const execution = await this.executeCommand(context.tenantId, actor, parsed, {
      dryRun: false,
      sessionState: this.parseSessionState(session.stateData),
    });

    await this.sendReply(context, user.id, from, session.id, execution.message, execution.useTemplate ?? false);

    await this.prisma.whatsAppSession.update({
      where: { id: session.id },
      data: {
        state: execution.nextState ?? session.state,
        stateData: execution.nextSessionState
          ? (execution.nextSessionState as Prisma.InputJsonValue)
          : session.stateData ?? Prisma.JsonNull,
      },
    });

    if (parsed.name === 'UNKNOWN') {
      await this.notificationsService.emitToUser({
        tenantId: context.tenantId,
        userId: user.id,
        eventKey: `whatsapp-unknown-command:${inboundMessage.id}`,
        eventType: 'WHATSAPP_UNKNOWN_COMMAND',
        title: 'Unknown WhatsApp command',
        body: textBody,
        payload: {
          raw: textBody,
        },
        channels: ['IN_APP'],
        source: NotificationSource.WHATSAPP,
      });
    }

    await this.auditService.log({
      tenantId: context.tenantId,
      actorId: user.id,
      action: 'WHATSAPP_INBOUND_COMMAND',
      entityType: 'WhatsAppMessage',
      entityId: inboundMessage.id,
      metadata: {
        command: parsed.name,
      },
    });

    void value;
  }

  private async executeCommand(
    tenantId: string,
    actor: Express.User,
    parsed: ParsedWhatsappCommand,
    options: { dryRun: boolean; sessionState: Record<string, unknown> },
  ): Promise<{
    message: string;
    nextState?: WhatsAppSessionState;
    nextSessionState?: Record<string, unknown>;
    useTemplate?: boolean;
  }> {
    const now = new Date();

    if (parsed.name === 'CHECK_IN') {
      if (options.dryRun) {
        return { message: 'Dry-run: check-in would be recorded now.' };
      }
      await this.attendanceService.checkIn(tenantId, actor, undefined, { occurredAt: now });
      return { message: 'Check-in recorded successfully.' };
    }

    if (parsed.name === 'CHECK_OUT') {
      if (options.dryRun) {
        return { message: 'Dry-run: check-out would be recorded now.' };
      }
      await this.attendanceService.checkOut(tenantId, actor, undefined, { occurredAt: now });
      return { message: 'Check-out recorded successfully.' };
    }

    if (parsed.name === 'TASKS') {
      const tasks = await this.prisma.task.findMany({
        where: {
          tenantId,
          assigneeId: actor.sub,
          deletedAt: null,
          status: {
            isDone: false,
          },
        },
        select: {
          key: true,
          title: true,
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      });

      if (tasks.length === 0) {
        return { message: 'No active assigned tasks found.' };
      }

      return {
        message: tasks.map((task) => `${task.key} - ${task.title}`).join('\n'),
      };
    }

    if (parsed.name === 'TASK_DETAIL') {
      const task = await this.prisma.task.findFirst({
        where: {
          tenantId,
          key: parsed.taskKey,
          deletedAt: null,
          assigneeId: actor.sub,
        },
        include: {
          status: { select: { name: true } },
          project: { select: { code: true } },
        },
      });

      if (!task) {
        return { message: `Task ${parsed.taskKey} not found in your scope.` };
      }

      return {
        message: `${task.key} (${task.status.name})\n${task.title}`,
        nextState: WhatsAppSessionState.ACTIVE,
        nextSessionState: {
          ...options.sessionState,
          activeTaskKey: task.key,
          activeProjectId: task.projectId,
        },
      };
    }

    if (parsed.name === 'TASK_START' || parsed.name === 'TASK_DONE') {
      const task = await this.prisma.task.findFirst({
        where: {
          tenantId,
          key: parsed.taskKey,
          deletedAt: null,
          assigneeId: actor.sub,
        },
        include: {
          project: true,
          status: true,
        },
      });

      if (!task) {
        return { message: `Task ${parsed.taskKey} not found in your scope.` };
      }

      const targetStatus = await this.prisma.taskStatus.findFirst({
        where: {
          tenantId,
          projectId: task.projectId,
          deletedAt: null,
          ...(parsed.name === 'TASK_DONE' ? { isDone: true } : { isDone: false }),
          ...(parsed.name === 'TASK_START' ? { code: 'IN_PROGRESS' } : {}),
        },
        orderBy: { position: 'asc' },
      });

      if (!targetStatus) {
        return { message: 'No suitable status found for this action.' };
      }

      if (!options.dryRun) {
        await this.prisma.task.update({
          where: { id: task.id },
          data: {
            taskStatusId: targetStatus.id,
          },
        });

        await this.auditService.log({
          tenantId,
          actorId: actor.sub,
          action: parsed.name === 'TASK_DONE' ? 'TASK_DONE_WHATSAPP' : 'TASK_START_WHATSAPP',
          entityType: 'Task',
          entityId: task.id,
          metadata: {
            fromStatusId: task.taskStatusId,
            toStatusId: targetStatus.id,
          },
        });
      }

      return {
        message:
          parsed.name === 'TASK_DONE'
            ? `Task ${task.key} marked done.`
            : `Task ${task.key} moved to ${targetStatus.name}.`,
        nextState: WhatsAppSessionState.ACTIVE,
        nextSessionState: {
          ...options.sessionState,
          activeTaskKey: task.key,
          activeProjectId: task.projectId,
        },
      };
    }

    if (parsed.name === 'TASK_BLOCK') {
      const task = await this.prisma.task.findFirst({
        where: {
          tenantId,
          key: parsed.taskKey,
          deletedAt: null,
          assigneeId: actor.sub,
        },
        select: {
          id: true,
          key: true,
          projectId: true,
        },
      });

      if (!task) {
        return { message: `Task ${parsed.taskKey} not found in your scope.` };
      }

      if (!options.dryRun) {
        await this.prisma.taskComment.create({
          data: {
            tenantId,
            projectId: task.projectId,
            taskId: task.id,
            authorId: actor.sub,
            content: `BLOCKED: ${parsed.reason}`,
          },
        });
      }

      return {
        message: `Blocker noted on ${task.key}.`,
        nextState: WhatsAppSessionState.ACTIVE,
        nextSessionState: {
          ...options.sessionState,
          activeTaskKey: task.key,
          activeProjectId: task.projectId,
        },
      };
    }

    if (parsed.name === 'TASK_LOG') {
      const task = await this.prisma.task.findFirst({
        where: {
          tenantId,
          key: parsed.taskKey,
          deletedAt: null,
          assigneeId: actor.sub,
        },
        select: {
          id: true,
          key: true,
          projectId: true,
        },
      });

      if (!task) {
        return { message: `Task ${parsed.taskKey} not found in your scope.` };
      }

      if (options.dryRun) {
        return {
          message: `Dry-run: ${parsed.hours}h would be logged against ${task.key}.`,
        };
      }

      await this.timeEntriesService.createTimeEntry(tenantId, actor, {
        projectId: task.projectId,
        taskId: task.id,
        entryDate: now,
        hours: parsed.hours,
        source: TimeEntrySource.WHATSAPP,
        note: `Logged via WhatsApp command for ${task.key}`,
      });

      return {
        message: `${parsed.hours}h logged for ${task.key}.`,
        nextState: WhatsAppSessionState.ACTIVE,
        nextSessionState: {
          ...options.sessionState,
          activeTaskKey: task.key,
          activeProjectId: task.projectId,
        },
      };
    }

    if (parsed.name === 'LEAVE_APPLY') {
      const requestDate = await this.resolveDateToken(tenantId, parsed.dateToken);
      const leaveType = await this.resolveLeaveType(tenantId, parsed.reason);

      if (!leaveType) {
        return { message: 'No active leave type found for this request.' };
      }

      if (options.dryRun) {
        return {
          message: `Dry-run: leave (${leaveType.code}) would be requested for ${requestDate.toISOString().slice(0, 10)}.`,
        };
      }

      const created = await this.leaveService.createLeaveRequest(tenantId, actor, {
        leaveTypeId: leaveType.id,
        startDate: requestDate,
        endDate: requestDate,
        reason: parsed.reason,
      });

      return {
        message: `Leave request submitted (request #${created.requestCode ?? 'N/A'}).`,
      };
    }

    if (parsed.name === 'WFH_APPLY') {
      const requestDate = await this.resolveDateToken(tenantId, parsed.dateToken);

      if (options.dryRun) {
        return {
          message: `Dry-run: WFH would be requested for ${requestDate.toISOString().slice(0, 10)}.`,
        };
      }

      const created = await this.wfhService.createRequest(tenantId, actor, {
        requestDate,
        reason: parsed.reason,
      });

      return {
        message: `WFH request submitted (request #${created.requestCode ?? 'N/A'}).`,
      };
    }

    if (parsed.name === 'EXPENSE_APPLY') {
      const category = await this.resolveExpenseCategory(tenantId, parsed.categoryToken);
      if (!category) {
        return { message: `Expense category '${parsed.categoryToken}' not found.` };
      }

      const activeTaskKey = typeof options.sessionState.activeTaskKey === 'string'
        ? options.sessionState.activeTaskKey
        : null;

      if (!activeTaskKey) {
        return {
          message: 'Please open a task first (`task T-101`) so expense can be linked to its project.',
          nextState: WhatsAppSessionState.AWAITING_CONFIRMATION,
        };
      }

      const task = await this.prisma.task.findFirst({
        where: {
          tenantId,
          key: activeTaskKey,
          deletedAt: null,
          assigneeId: actor.sub,
        },
        select: {
          projectId: true,
          key: true,
        },
      });

      if (!task) {
        return {
          message: 'Active task context is invalid. Use `task T-101` and retry expense command.',
          nextState: WhatsAppSessionState.AWAITING_CONFIRMATION,
        };
      }

      const tenantSettings = await this.prisma.tenantSetting.findUnique({
        where: { tenantId },
        select: { currency: true },
      });

      if (options.dryRun) {
        return {
          message: `Dry-run: expense ${parsed.amount} would be created in category ${category.code} for project of ${task.key}.`,
        };
      }

      const created = await this.expensesService.createExpense(tenantId, actor, {
        amount: parsed.amount,
        categoryId: category.id,
        currency: tenantSettings?.currency ?? 'INR',
        description: parsed.description,
        expenseDate: now,
        projectId: task.projectId,
      });

      return {
        message: `Expense request submitted (request #${created.requestCode ?? 'N/A'}).`,
      };
    }

    if (parsed.name === 'LEAVE_APPROVE' || parsed.name === 'LEAVE_REJECT') {
      const leaveRequest = await this.prisma.leaveRequest.findFirst({
        where: {
          tenantId,
          requestCode: parsed.requestCode,
        },
        select: {
          id: true,
        },
      });

      if (!leaveRequest) {
        return { message: `Leave request #${parsed.requestCode} not found.` };
      }

      const approval = await this.approvalsService.getByTarget(
        tenantId,
        ApprovalTargetType.LEAVE_REQUEST,
        leaveRequest.id,
      );

      if (!approval) {
        return { message: `Approval record not found for leave request #${parsed.requestCode}.` };
      }

      if (options.dryRun) {
        return {
          message: `Dry-run: leave request #${parsed.requestCode} would be ${parsed.name === 'LEAVE_APPROVE' ? 'approved' : 'rejected'}.`,
        };
      }

      if (parsed.name === 'LEAVE_APPROVE') {
        await this.approvalsService.approve(tenantId, actor, approval.id, {
          reason: 'Approved via WhatsApp command',
        });
        return { message: `Leave request #${parsed.requestCode} approved.` };
      }

      await this.approvalsService.reject(tenantId, actor, approval.id, {
        reason: parsed.reason,
      });
      return { message: `Leave request #${parsed.requestCode} rejected.` };
    }

    if (parsed.name === 'LEAVE_BALANCE') {
      const balance = await this.leaveService.getMyBalance(tenantId, actor, {});
      if (!balance.balances.length) {
        return { message: 'No leave balance records found.' };
      }

      return {
        message: balance.balances
          .map(
            (entry) =>
              `${entry.code}: available ${entry.available}, pending ${entry.usedPending}`,
          )
          .join('\n'),
      };
    }

    if (parsed.name === 'MY_PERFORMANCE') {
      const nowDate = new Date();
      const fromDate = new Date(nowDate);
      fromDate.setUTCDate(fromDate.getUTCDate() - 6);
      fromDate.setUTCHours(0, 0, 0, 0);

      const [completedTasks, totalHours, attendanceAgg, blockers] = await Promise.all([
        this.prisma.task.count({
          where: {
            tenantId,
            assigneeId: actor.sub,
            deletedAt: null,
            updatedAt: { gte: fromDate },
            status: { isDone: true },
          },
        }),
        this.prisma.timeEntry.aggregate({
          where: {
            tenantId,
            userId: actor.sub,
            entryDate: { gte: fromDate },
          },
          _sum: {
            hours: true,
          },
        }),
        this.prisma.attendanceDay.aggregate({
          where: {
            tenantId,
            userId: actor.sub,
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
            authorId: actor.sub,
            content: { startsWith: 'BLOCKED:' },
            task: {
              deletedAt: null,
              status: {
                isDone: false,
              },
            },
          },
        }),
      ]);

      const hours = Number(totalHours._sum.hours ?? 0);
      const late = attendanceAgg._sum.lateMinutes ?? 0;
      const early = attendanceAgg._sum.earlyLogoutMinutes ?? 0;

      return {
        message: [
          '7-day snapshot',
          `Tasks completed: ${completedTasks}`,
          `Hours logged: ${hours}`,
          `Late minutes: ${late}`,
          `Early logout minutes: ${early}`,
          `Open blockers: ${blockers}`,
        ].join('\n'),
      };
    }

    return {
      message:
        'Unknown command. Try: check in, check out, tasks, task T-101, start T-101, done T-101, block T-101 reason, log 2h T-101, apply leave tomorrow sick, apply wfh today reason, expense 450 travel description, approve leave 123, reject leave 123 reason, leave balance, my performance.',
    };
  }

  private async sendReply(
    context: WhatsAppWebhookContext,
    userId: string,
    userPhone: string,
    sessionId: string,
    message: string,
    forceTemplate: boolean,
  ) {
    const session = await this.prisma.whatsAppSession.findUnique({
      where: { id: sessionId },
    });

    const now = new Date();
    const within24h = session ? now.getTime() - session.lastInboundAt.getTime() <= 24 * 60 * 60 * 1000 : false;

    const useTemplate = forceTemplate || !within24h;

    const response = useTemplate
      ? await this.sendTemplateMessage(
          context,
          userPhone,
          String(context.config.utilityTemplateName ?? 'utility_notification'),
          [],
        )
      : await this.sendTextMessage(context, userPhone, message);

    await this.prisma.whatsAppMessage.create({
      data: {
        tenantId: context.tenantId,
        userId,
        sessionId,
        waUserPhone: userPhone,
        direction: WhatsAppMessageDirection.OUTBOUND,
        messageType: useTemplate ? WhatsAppMessageType.TEMPLATE : WhatsAppMessageType.TEXT,
        textBody: message,
        commandName: null,
        rawPayload: response.requestBody as Prisma.InputJsonValue,
        parsedCommand: Prisma.JsonNull,
        status: WhatsAppMessageStatus.SENT,
        providerMessageId: response.providerMessageId,
      },
    });

    await this.prisma.whatsAppSession.update({
      where: { id: sessionId },
      data: {
        lastOutboundAt: now,
        isWithin24hWindow: within24h,
      },
    });
  }

  private async sendTextMessage(
    context: WhatsAppWebhookContext,
    toPhone: string,
    body: string,
  ): Promise<{ providerMessageId: string | null; requestBody: Record<string, unknown> }> {
    const requestBody = {
      messaging_product: 'whatsapp',
      to: toPhone,
      type: 'text',
      text: {
        body,
      },
    };

    const responseJson = await this.sendViaMeta(context, requestBody);
    return {
      providerMessageId: this.extractMessageId(responseJson),
      requestBody,
    };
  }

  private async sendTemplateMessage(
    context: WhatsAppWebhookContext,
    toPhone: string,
    templateName: string,
    parameters: string[],
  ): Promise<{ providerMessageId: string | null; requestBody: Record<string, unknown> }> {
    const requestBody = {
      messaging_product: 'whatsapp',
      to: toPhone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'en',
        },
        components:
          parameters.length > 0
            ? [
                {
                  type: 'body',
                  parameters: parameters.map((value) => ({ type: 'text', text: value })),
                },
              ]
            : undefined,
      },
    };

    const responseJson = await this.sendViaMeta(context, requestBody);
    return {
      providerMessageId: this.extractMessageId(responseJson),
      requestBody,
    };
  }

  private async sendViaMeta(
    context: WhatsAppWebhookContext,
    requestBody: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const accessToken = context.secrets.accessToken;
    const apiVersion = String(context.config.apiVersion ?? 'v20.0');
    const phoneNumberId = String(context.config.phoneNumberId ?? '');

    if (!accessToken || !phoneNumberId) {
      throw new BadRequestException('WhatsApp access token or phoneNumberId missing');
    }

    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseJson = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      throw new BadRequestException(`WhatsApp send failed: HTTP ${response.status}`);
    }

    return responseJson;
  }

  private extractMessageId(responseJson: Record<string, unknown>): string | null {
    const messages = responseJson.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return null;
    }

    const first = messages[0] as Record<string, unknown>;
    return typeof first.id === 'string' ? first.id : null;
  }

  private async resolveTenantByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppWebhookContext | null> {
    const setting = await this.prisma.integrationSetting.findFirst({
      where: {
        type: IntegrationType.WHATSAPP,
        enabled: true,
        config: {
          path: '$.phoneNumberId',
          equals: phoneNumberId,
        },
      },
    });

    if (!setting) {
      return null;
    }

    return {
      tenantId: setting.tenantId,
      settingId: setting.id,
      config: this.settingsService.readConfig(setting.config),
      secrets: this.settingsService.readSecrets(setting.encryptedSecrets),
    };
  }

  private async getWhatsAppContextByTenantId(tenantId: string): Promise<WhatsAppWebhookContext | null> {
    const setting = await this.prisma.integrationSetting.findUnique({
      where: {
        tenantId_type: {
          tenantId,
          type: IntegrationType.WHATSAPP,
        },
      },
    });

    if (!setting || !setting.enabled) {
      return null;
    }

    return {
      tenantId,
      settingId: setting.id,
      config: this.settingsService.readConfig(setting.config),
      secrets: this.settingsService.readSecrets(setting.encryptedSecrets),
    };
  }

  private async upsertSession(tenantId: string, userId: string, waUserPhone: string) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    const existing = await this.prisma.whatsAppSession.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId,
        },
      },
    });

    if (!existing) {
      return this.prisma.whatsAppSession.create({
        data: {
          tenantId,
          userId,
          waUserPhone,
          lastInboundAt: now,
          isWithin24hWindow: true,
          state: WhatsAppSessionState.ACTIVE,
          expiresAt,
        },
      });
    }

    const timedOut = existing.updatedAt.getTime() < now.getTime() - 10 * 60 * 1000;

    return this.prisma.whatsAppSession.update({
      where: { id: existing.id },
      data: {
        waUserPhone,
        lastInboundAt: now,
        isWithin24hWindow: true,
        state: timedOut ? WhatsAppSessionState.IDLE : existing.state,
        stateData: timedOut
          ? ({} as Prisma.InputJsonValue)
          : existing.stateData ?? Prisma.JsonNull,
        expiresAt,
      },
    });
  }

  private async buildActor(tenantId: string, userId: string): Promise<Express.User> {
    const [user, userRoles] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          tenantId,
          id: userId,
          deletedAt: null,
          isActive: true,
        },
        select: {
          id: true,
        },
      }),
      this.prisma.userRole.findMany({
        where: {
          tenantId,
          userId,
        },
        select: {
          role: {
            select: {
              code: true,
              permissions: {
                select: {
                  permission: {
                    select: {
                      code: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found for WhatsApp command');
    }

    const roleCodes = Array.from(new Set(userRoles.map((entry) => entry.role.code)));
    const permissions = Array.from(
      new Set(
        userRoles.flatMap((entry) =>
          entry.role.permissions.map((perm) => perm.permission.code),
        ),
      ),
    );

    return {
      sub: user.id,
      tenantId,
      sessionId: 'whatsapp-session',
      roles: roleCodes,
      permissions,
    };
  }

  private async findUserByPhone(tenantId: string, phone: string) {
    const normalized = phone.replace(/\s+/g, '');
    const digits = normalized.replace(/[^0-9]/g, '');
    const candidates = Array.from(
      new Set([
        normalized,
        normalized.startsWith('+') ? normalized.slice(1) : normalized,
        digits,
        `+${digits}`,
      ]),
    );

    return this.prisma.user.findFirst({
      where: {
        tenantId,
        phone: {
          in: candidates,
        },
        deletedAt: null,
        isActive: true,
      },
    });
  }

  private parseSessionState(stateData: Prisma.JsonValue | null): Record<string, unknown> {
    if (!stateData || typeof stateData !== 'object' || Array.isArray(stateData)) {
      return {};
    }

    return stateData as Record<string, unknown>;
  }

  private async resolveLeaveType(tenantId: string, reason: string) {
    const firstWord = reason.split(/\s+/)[0]?.trim().toUpperCase();

    return this.prisma.leaveType.findFirst({
      where: {
        tenantId,
        isActive: true,
        ...(firstWord
          ? {
              OR: [{ code: firstWord }, { name: { contains: firstWord } }],
            }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async resolveExpenseCategory(tenantId: string, token: string) {
    const normalized = token.trim().toUpperCase();

    return this.prisma.expenseCategory.findFirst({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { code: normalized },
          { name: { contains: token } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async resolveDateToken(tenantId: string, token: string): Promise<Date> {
    const lower = token.toLowerCase();
    const timezone = await this.getTenantTimezone(tenantId);

    const baseDate = this.currentDateInTimezone(timezone);

    if (lower === 'today') {
      return baseDate;
    }

    if (lower === 'tomorrow') {
      const next = new Date(baseDate);
      next.setUTCDate(baseDate.getUTCDate() + 1);
      return next;
    }

    const parsed = new Date(token);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Unsupported date token '${token}'. Use today/tomorrow or ISO date.`);
    }

    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  }

  private async getTenantTimezone(tenantId: string): Promise<string> {
    const settings = await this.prisma.tenantSetting.findUnique({
      where: { tenantId },
      select: { timezone: true },
    });

    return settings?.timezone ?? 'UTC';
  }

  private currentDateInTimezone(timezone: string): Date {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(new Date());
    const year = Number(parts.find((part) => part.type === 'year')?.value ?? '1970');
    const month = Number(parts.find((part) => part.type === 'month')?.value ?? '01');
    const day = Number(parts.find((part) => part.type === 'day')?.value ?? '01');

    return new Date(Date.UTC(year, month - 1, day));
  }

  private async getTaskKeyRegex(tenantId: string): Promise<string> {
    const githubSetting = await this.prisma.integrationSetting.findUnique({
      where: {
        tenantId_type: {
          tenantId,
          type: IntegrationType.GITHUB,
        },
      },
      select: {
        config: true,
      },
    });

    const config = this.settingsService.readConfig(githubSetting?.config ?? null);
    return typeof config.taskKeyRegex === 'string' && config.taskKeyRegex.length > 0
      ? config.taskKeyRegex
      : 'T-\\d+';
  }

  private readArray(payload: unknown, path: string[]): Array<Record<string, unknown>> {
    const value = this.readUnknown(payload, path);
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object' && !Array.isArray(entry));
  }

  private readObject(payload: unknown, path: string[]): Record<string, unknown> {
    const value = this.readUnknown(payload, path);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private readString(payload: unknown, path: string[]): string | null {
    const value = this.readUnknown(payload, path);
    return typeof value === 'string' ? value : null;
  }

  private readUnknown(payload: unknown, path: string[]): unknown {
    let current = payload;

    for (const key of path) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }
}
