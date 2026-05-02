import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import {
  DependencyType,
  NotificationEventStatus,
  Prisma,
  TaskPriority,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TaskDependencyService } from '../../common/services/task-dependency.service';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { AuditService } from '../audit/audit.service';
import { BulkTaskOperationsDto } from './dto/bulk-task-operations.dto';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { CreateTaskDependencyDto } from './dto/create-task-dependency.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { GetTaskKanbanDto } from './dto/get-task-kanban.dto';
import { ListTaskCommentsDto } from './dto/list-task-comments.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: TenantRbacScopeService,
    private readonly auditService: AuditService,
    private readonly dependencyService: TaskDependencyService,
    @InjectQueue('notification-events')
    private readonly notificationQueue: Queue,
  ) {}

  async createTask(tenantId: string, actor: Express.User, dto: CreateTaskDto) {
    if (this.scopeService.isEndUser(actor)) {
      throw new ForbiddenException('USER cannot create tasks');
    }

    const project = await this.scopeService.ensureProjectManageAccess(
      tenantId,
      dto.projectId,
      actor,
    );

    const [status, assignee, milestone, parentTask] = await Promise.all([
      this.getTaskStatusInProject(tenantId, dto.projectId, dto.statusId),
      this.resolveAssignee(tenantId, actor, dto.assigneeId, dto.projectId),
      this.resolveMilestone(tenantId, dto.projectId, dto.milestoneId),
      this.resolveParentTask(tenantId, dto.projectId, dto.parentTaskId),
    ]);

    if (status.requiresLocation || status.requiresSelfie) {
      // These checks are enforced during explicit status transitions, not task creation.
    }

    try {
      const createdTask = await this.prisma.$transaction(async (tx) => {
        const currentProject = await tx.project.findFirst({
          where: {
            id: project.id,
            tenantId,
            deletedAt: null,
          },
          select: {
            id: true,
            code: true,
            nextTaskSequence: true,
          },
        });

        if (!currentProject) {
          throw new NotFoundException('Project not found');
        }

        const sequence = currentProject.nextTaskSequence;
        const key = `${currentProject.code}-${sequence}`;

        await tx.project.update({
          where: { id: currentProject.id },
          data: {
            nextTaskSequence: {
              increment: 1,
            },
            updatedBy: actor.sub,
          },
        });

        return tx.task.create({
          data: {
            tenantId,
            projectId: dto.projectId,
            milestoneId: milestone?.id,
            parentTaskId: parentTask?.id,
            taskStatusId: status.id,
            key,
            title: dto.title,
            description: dto.description,
            assigneeId: assignee?.id,
            estimateHours:
              dto.estimateHours !== undefined
                ? new Prisma.Decimal(dto.estimateHours)
                : undefined,
            priority: dto.priority ?? TaskPriority.MEDIUM,
            dueDate: dto.dueDate,
            tags: dto.tags as Prisma.InputJsonValue | undefined,
            externalReferences:
              dto.externalReferences as Prisma.InputJsonValue | undefined,
            createdBy: actor.sub,
            updatedBy: actor.sub,
          },
          include: {
            status: true,
            assignee: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        });
      });

      await this.auditService.log({
        tenantId,
        actorId: actor.sub,
        action: 'TASK_CREATE',
        entityType: 'Task',
        entityId: createdTask.id,
        metadata: {
          key: createdTask.key,
          projectId: createdTask.projectId,
          assigneeId: createdTask.assigneeId,
          statusId: createdTask.taskStatusId,
        },
      });

      return createdTask;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Task key already exists');
      }

      throw error;
    }
  }

  async listTasks(tenantId: string, actor: Express.User, query: ListTasksDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.TaskWhereInput = {
      tenantId,
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search } },
              { key: { contains: query.search } },
              { description: { contains: query.search } },
            ],
          }
        : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.statusId ? { taskStatusId: query.statusId } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.milestoneId ? { milestoneId: query.milestoneId } : {}),
      ...(query.parentTaskId ? { parentTaskId: query.parentTaskId } : {}),
      ...(query.dueAfter || query.dueBefore
        ? {
            dueDate: {
              gte: query.dueAfter,
              lte: query.dueBefore,
            },
          }
        : {}),
    };

    await this.applyTaskVisibilityWhere(tenantId, actor, where);

    const [total, tasks] = await this.prisma.$transaction([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        include: {
          status: {
            select: {
              id: true,
              name: true,
              code: true,
              isDone: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          milestone: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: tasks,
      page,
      limit,
      total,
    };
  }

  async getTaskById(tenantId: string, actor: Express.User, taskId: string) {
    await this.scopeService.ensureTaskReadAccess(tenantId, taskId, actor);

    const task = await this.prisma.task.findFirst({
      where: {
        tenantId,
        id: taskId,
        deletedAt: null,
      },
      include: {
        status: true,
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        milestone: {
          select: {
            id: true,
            name: true,
          },
        },
        parentTask: {
          select: {
            id: true,
            key: true,
            title: true,
          },
        },
        subtasks: {
          where: { deletedAt: null },
          select: {
            id: true,
            key: true,
            title: true,
            taskStatusId: true,
          },
        },
        dependsOn: {
          include: {
            dependsOnTask: {
              select: {
                id: true,
                key: true,
                title: true,
              },
            },
          },
        },
        requiredBy: {
          include: {
            task: {
              select: {
                id: true,
                key: true,
                title: true,
              },
            },
          },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async updateTask(
    tenantId: string,
    actor: Express.User,
    taskId: string,
    dto: UpdateTaskDto,
  ) {
    const existingTask = await this.scopeService.ensureTaskManageAccess(
      tenantId,
      taskId,
      actor,
    );

    if (this.scopeService.isEndUser(actor)) {
      this.assertUserUpdateFields(dto);
    }

    const status = dto.statusId
      ? await this.getTaskStatusInProject(tenantId, existingTask.projectId, dto.statusId)
      : existingTask.status;

    const assignee = await this.resolveAssignee(
      tenantId,
      actor,
      dto.assigneeId === null ? undefined : dto.assigneeId,
      existingTask.projectId,
      dto.assigneeId === null,
    );

    const milestone = await this.resolveMilestone(
      tenantId,
      existingTask.projectId,
      dto.milestoneId === null ? undefined : dto.milestoneId,
      dto.milestoneId === null,
    );

    const parentTask = await this.resolveParentTask(
      tenantId,
      existingTask.projectId,
      dto.parentTaskId === null ? undefined : dto.parentTaskId,
      dto.parentTaskId === null,
      existingTask.id,
    );

    if (dto.statusId) {
      await this.ensureTransitionAllowed(
        tenantId,
        existingTask.projectId,
        existingTask.taskStatusId,
        dto.statusId,
      );

      if (status.requiresLocation || status.requiresSelfie) {
        throw new BadRequestException(
          'Use /tasks/:id/status when target status requires location or selfie',
        );
      }
    }

    const reopenedIncrement =
      dto.statusId && existingTask.status.isDone && !status.isDone ? 1 : 0;

    const updated = await this.prisma.task.update({
      where: { id: existingTask.id },
      data: {
        title: dto.title,
        description: dto.description,
        taskStatusId: dto.statusId,
        assigneeId:
          dto.assigneeId === null
            ? null
            : dto.assigneeId !== undefined
              ? assignee?.id
              : undefined,
        estimateHours:
          dto.estimateHours !== undefined
            ? new Prisma.Decimal(dto.estimateHours)
            : undefined,
        priority: dto.priority,
        dueDate: dto.dueDate,
        tags: dto.tags as Prisma.InputJsonValue | undefined,
        milestoneId:
          dto.milestoneId === null
            ? null
            : dto.milestoneId !== undefined
              ? milestone?.id
              : undefined,
        parentTaskId:
          dto.parentTaskId === null
            ? null
            : dto.parentTaskId !== undefined
              ? parentTask?.id
              : undefined,
        externalReferences:
          dto.externalReferences as Prisma.InputJsonValue | undefined,
        reopenedCount:
          reopenedIncrement > 0
            ? {
                increment: reopenedIncrement,
              }
            : undefined,
        updatedBy: actor.sub,
      },
      include: {
        status: true,
        assignee: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'TASK_UPDATE',
      entityType: 'Task',
      entityId: existingTask.id,
      metadata: dto as Record<string, unknown>,
    });

    return updated;
  }

  async deleteTask(
    tenantId: string,
    actor: Express.User,
    taskId: string,
  ): Promise<{ deleted: boolean }> {
    if (this.scopeService.isEndUser(actor)) {
      throw new ForbiddenException('USER cannot delete tasks');
    }

    const existingTask = await this.scopeService.ensureTaskManageAccess(
      tenantId,
      taskId,
      actor,
    );

    await this.prisma.task.update({
      where: { id: existingTask.id },
      data: {
        deletedAt: new Date(),
        updatedBy: actor.sub,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'TASK_DELETE',
      entityType: 'Task',
      entityId: existingTask.id,
    });

    return { deleted: true };
  }

  async changeStatus(
    tenantId: string,
    actor: Express.User,
    taskId: string,
    dto: ChangeTaskStatusDto,
  ) {
    const existingTask = await this.scopeService.ensureTaskManageAccess(
      tenantId,
      taskId,
      actor,
    );

    const targetStatus = await this.getTaskStatusInProject(
      tenantId,
      existingTask.projectId,
      dto.statusId,
    );

    await this.ensureTransitionAllowed(
      tenantId,
      existingTask.projectId,
      existingTask.taskStatusId,
      dto.statusId,
    );

    if (
      targetStatus.requiresLocation &&
      (dto.locationLatitude === undefined || dto.locationLongitude === undefined)
    ) {
      throw new BadRequestException(
        'Location coordinates are required for target status',
      );
    }

    if (targetStatus.requiresSelfie && !dto.selfieAttachmentId) {
      throw new BadRequestException('Selfie attachment is required for target status');
    }

    if (dto.selfieAttachmentId) {
      const attachment = await this.prisma.taskAttachment.findFirst({
        where: {
          tenantId,
          id: dto.selfieAttachmentId,
          taskId: existingTask.id,
        },
        select: { id: true },
      });

      if (!attachment) {
        throw new BadRequestException('Invalid selfieAttachmentId for task');
      }
    }

    const reopenedIncrement = existingTask.status.isDone && !targetStatus.isDone ? 1 : 0;

    const updated = await this.prisma.task.update({
      where: { id: existingTask.id },
      data: {
        taskStatusId: targetStatus.id,
        reopenedCount:
          reopenedIncrement > 0
            ? {
                increment: reopenedIncrement,
              }
            : undefined,
        updatedBy: actor.sub,
      },
      include: {
        status: true,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'TASK_STATUS_CHANGE',
      entityType: 'Task',
      entityId: existingTask.id,
      metadata: {
        fromStatusId: existingTask.taskStatusId,
        toStatusId: targetStatus.id,
        locationLatitude: dto.locationLatitude,
        locationLongitude: dto.locationLongitude,
        selfieAttachmentId: dto.selfieAttachmentId,
      },
    });

    return updated;
  }

  async getKanban(tenantId: string, actor: Express.User, query: GetTaskKanbanDto) {
    await this.scopeService.ensureProjectReadAccess(tenantId, query.projectId, actor);

    const statuses = await this.prisma.taskStatus.findMany({
      where: {
        tenantId,
        projectId: query.projectId,
        deletedAt: null,
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        isDone: true,
        requiresLocation: true,
        requiresSelfie: true,
      },
    });

    const where: Prisma.TaskWhereInput = {
      tenantId,
      projectId: query.projectId,
      deletedAt: null,
    };

    await this.applyTaskVisibilityWhere(tenantId, actor, where);

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
          },
        },
        milestone: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return {
      projectId: query.projectId,
      columns: statuses.map((status) => ({
        ...status,
        tasks: tasks.filter((task) => task.taskStatusId === status.id),
      })),
    };
  }

  async bulkOperate(
    tenantId: string,
    actor: Express.User,
    dto: BulkTaskOperationsDto,
  ): Promise<{ updated: number }> {
    if (this.scopeService.isEndUser(actor)) {
      throw new ForbiddenException('USER cannot perform bulk task operations');
    }

    if (
      !dto.assignToUserId &&
      !dto.statusId &&
      dto.dueDateShiftDays === undefined
    ) {
      throw new BadRequestException('At least one bulk operation must be provided');
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        tenantId,
        id: {
          in: dto.taskIds,
        },
        deletedAt: null,
      },
      include: {
        status: true,
      },
    });

    if (tasks.length !== dto.taskIds.length) {
      throw new NotFoundException('One or more tasks not found');
    }

    const projectIds = Array.from(new Set(tasks.map((task) => task.projectId)));
    const firstTask = tasks[0];

    if (!firstTask) {
      throw new NotFoundException('No tasks found for bulk operation');
    }

    for (const projectId of projectIds) {
      await this.scopeService.ensureProjectManageAccess(tenantId, projectId, actor);
    }

    if (dto.statusId && projectIds.length > 1) {
      throw new BadRequestException(
        'Bulk status change supports tasks from one project per request',
      );
    }

    const assignee = await this.resolveAssignee(
      tenantId,
      actor,
      dto.assignToUserId,
      firstTask.projectId,
    );

    let targetStatus:
      | {
          id: string;
          isDone: boolean;
          requiresLocation: boolean;
          requiresSelfie: boolean;
          projectId: string;
        }
      | undefined;

    if (dto.statusId) {
      targetStatus = await this.getTaskStatusInProject(
        tenantId,
        firstTask.projectId,
        dto.statusId,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const task of tasks) {
        let reopenedIncrement = 0;

        if (targetStatus) {
          await this.ensureTransitionAllowed(
            tenantId,
            task.projectId,
            task.taskStatusId,
            targetStatus.id,
          );
          reopenedIncrement = task.status.isDone && !targetStatus.isDone ? 1 : 0;
        }

        const shiftedDueDate =
          dto.dueDateShiftDays !== undefined
            ? this.shiftDueDate(task.dueDate, dto.dueDateShiftDays)
            : undefined;

        await tx.task.update({
          where: { id: task.id },
          data: {
            assigneeId: assignee?.id,
            taskStatusId: targetStatus?.id,
            dueDate: shiftedDueDate,
            reopenedCount:
              reopenedIncrement > 0
                ? {
                    increment: reopenedIncrement,
                  }
                : undefined,
            updatedBy: actor.sub,
          },
        });
      }
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'TASK_BULK_UPDATE',
      entityType: 'Task',
      metadata: {
        taskIds: dto.taskIds,
        assignToUserId: dto.assignToUserId,
        statusId: dto.statusId,
        dueDateShiftDays: dto.dueDateShiftDays,
      },
    });

    return { updated: tasks.length };
  }

  async createDependency(
    tenantId: string,
    actor: Express.User,
    taskId: string,
    dto: CreateTaskDependencyDto,
  ) {
    const task = await this.scopeService.ensureTaskManageAccess(tenantId, taskId, actor);
    const dependsOnTask = await this.scopeService.ensureTaskReadAccess(
      tenantId,
      dto.dependsOnTaskId,
      actor,
    );

    if (task.projectId !== dependsOnTask.projectId) {
      throw new BadRequestException('Dependencies must be within same project');
    }

    const wouldCycle = await this.dependencyService.wouldCreateCycle(
      tenantId,
      task.id,
      dependsOnTask.id,
    );

    if (wouldCycle) {
      throw new BadRequestException('Circular dependency is not allowed');
    }

    try {
      const dependency = await this.prisma.taskDependency.create({
        data: {
          tenantId,
          projectId: task.projectId,
          taskId: task.id,
          dependsOnTaskId: dependsOnTask.id,
          type: dto.type ?? DependencyType.FINISH_TO_START,
          createdBy: actor.sub,
        },
      });

      await this.auditService.log({
        tenantId,
        actorId: actor.sub,
        action: 'TASK_DEPENDENCY_CREATE',
        entityType: 'TaskDependency',
        entityId: dependency.id,
        metadata: {
          taskId,
          dependsOnTaskId: dto.dependsOnTaskId,
          type: dependency.type,
        },
      });

      return dependency;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Dependency already exists');
      }

      throw error;
    }
  }

  async deleteDependency(
    tenantId: string,
    actor: Express.User,
    taskId: string,
    dependencyId: string,
  ): Promise<{ deleted: boolean }> {
    await this.scopeService.ensureTaskManageAccess(tenantId, taskId, actor);

    const dependency = await this.prisma.taskDependency.findFirst({
      where: {
        tenantId,
        id: dependencyId,
        taskId,
      },
      select: {
        id: true,
      },
    });

    if (!dependency) {
      throw new NotFoundException('Dependency not found');
    }

    await this.prisma.taskDependency.delete({
      where: { id: dependency.id },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'TASK_DEPENDENCY_DELETE',
      entityType: 'TaskDependency',
      entityId: dependency.id,
      metadata: {
        taskId,
      },
    });

    return { deleted: true };
  }

  async createComment(
    tenantId: string,
    actor: Express.User,
    taskId: string,
    dto: CreateTaskCommentDto,
  ) {
    const task = await this.scopeService.ensureTaskReadAccess(tenantId, taskId, actor);

    const mentionedUserIds = Array.from(new Set(dto.mentionedUserIds ?? []));

    if (mentionedUserIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: {
          tenantId,
          id: {
            in: mentionedUserIds,
          },
          deletedAt: null,
          isActive: true,
        },
        select: { id: true },
      });

      if (users.length !== mentionedUserIds.length) {
        throw new BadRequestException('One or more mentioned users are invalid');
      }
    }

    const { comment, events } = await this.prisma.$transaction(async (tx) => {
      const createdComment = await tx.taskComment.create({
        data: {
          tenantId,
          projectId: task.projectId,
          taskId: task.id,
          authorId: actor.sub,
          content: dto.content,
        },
      });

      if (mentionedUserIds.length > 0) {
        await tx.taskCommentMention.createMany({
          data: mentionedUserIds.map((mentionedUserId) => ({
            tenantId,
            taskCommentId: createdComment.id,
            mentionedUserId,
          })),
          skipDuplicates: true,
        });
      }

      const eventsToCreate = mentionedUserIds
        .filter((mentionedUserId) => mentionedUserId !== actor.sub)
        .map((mentionedUserId) => ({
          tenantId,
          userId: mentionedUserId,
          eventType: 'TASK_COMMENT_MENTION',
          channel: 'IN_APP',
          payload: {
            taskId: task.id,
            taskKey: task.key,
            commentId: createdComment.id,
            mentionedByUserId: actor.sub,
          } as Prisma.InputJsonValue,
          status: NotificationEventStatus.PENDING,
        }));

      const createdEvents: Array<{ id: string }> = [];

      for (const event of eventsToCreate) {
        const createdEvent = await tx.notificationEvent.create({
          data: event,
          select: { id: true },
        });

        createdEvents.push(createdEvent);
      }

      return {
        comment: createdComment,
        events: createdEvents,
      };
    });

    for (const event of events) {
      await this.notificationQueue.add(
        'task-comment-mention',
        { eventId: event.id },
        {
          removeOnComplete: true,
          removeOnFail: 200,
        },
      );
    }

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'TASK_COMMENT_CREATE',
      entityType: 'TaskComment',
      entityId: comment.id,
      metadata: {
        taskId,
        mentionedUserIds,
      },
    });

    return comment;
  }

  async listComments(
    tenantId: string,
    actor: Express.User,
    taskId: string,
    query: ListTaskCommentsDto,
  ) {
    await this.scopeService.ensureTaskReadAccess(tenantId, taskId, actor);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [total, comments] = await this.prisma.$transaction([
      this.prisma.taskComment.count({
        where: {
          tenantId,
          taskId,
        },
      }),
      this.prisma.taskComment.findMany({
        where: {
          tenantId,
          taskId,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          mentions: {
            include: {
              mentionedUser: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: comments,
      page,
      limit,
      total,
    };
  }

  private async applyTaskVisibilityWhere(
    tenantId: string,
    actor: Express.User,
    where: Prisma.TaskWhereInput,
  ): Promise<void> {
    if (this.scopeService.isSuperAdmin(actor)) {
      return;
    }

    if (this.scopeService.isEndUser(actor)) {
      where.assigneeId = actor.sub;
      return;
    }

    const [projectIds, leadTeamIds] = await Promise.all([
      this.prisma.projectMember
        .findMany({
          where: {
            tenantId,
            userId: actor.sub,
          },
          select: {
            projectId: true,
          },
        })
        .then((rows) => rows.map((row) => row.projectId)),
      this.scopeService.getLeadTeamIds(tenantId, actor.sub),
    ]);

    if (projectIds.length === 0) {
      where.id = '__no_tasks__';
      return;
    }

    const whereProjectId =
      typeof where.projectId === 'string' ? where.projectId : undefined;

    where.projectId =
      whereProjectId && projectIds.includes(whereProjectId)
        ? whereProjectId
        : whereProjectId
          ? '__no_tasks__'
          : { in: projectIds };

    where.OR = [
      { assigneeId: null },
      {
        assignee: {
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

  private async getTaskStatusInProject(
    tenantId: string,
    projectId: string,
    statusId: string,
  ) {
    const status = await this.prisma.taskStatus.findFirst({
      where: {
        tenantId,
        projectId,
        id: statusId,
        deletedAt: null,
      },
      select: {
        id: true,
        isDone: true,
        requiresLocation: true,
        requiresSelfie: true,
        projectId: true,
      },
    });

    if (!status) {
      throw new BadRequestException('Invalid status for task project');
    }

    return status;
  }

  private async resolveAssignee(
    tenantId: string,
    actor: Express.User,
    assigneeId: string | undefined,
    projectId: string,
    clear = false,
  ): Promise<{ id: string } | null> {
    if (clear) {
      return null;
    }

    if (!assigneeId) {
      return null;
    }

    const assignee = await this.prisma.user.findFirst({
      where: {
        tenantId,
        id: assigneeId,
        deletedAt: null,
        isActive: true,
      },
      include: {
        teamMembership: {
          where: {
            tenantId,
          },
          select: {
            teamId: true,
          },
        },
      },
    });

    if (!assignee) {
      throw new BadRequestException('Assignee not found in tenant');
    }

    if (this.scopeService.isTeamLead(actor)) {
      const [member, leadTeamIds] = await Promise.all([
        this.prisma.projectMember.findFirst({
          where: {
            tenantId,
            projectId,
            userId: actor.sub,
          },
          select: { id: true },
        }),
        this.scopeService.getLeadTeamIds(tenantId, actor.sub),
      ]);

      if (!member) {
        throw new ForbiddenException('TEAM_LEAD can only manage own project tasks');
      }

      const assigneeTeamIds = assignee.teamMembership.map((entry) => entry.teamId);
      const hasOverlap = assigneeTeamIds.some((teamId) => leadTeamIds.includes(teamId));

      if (!hasOverlap) {
        throw new ForbiddenException(
          'TEAM_LEAD task assignment requires team overlap',
        );
      }
    }

    return { id: assignee.id };
  }

  private async resolveMilestone(
    tenantId: string,
    projectId: string,
    milestoneId: string | undefined,
    clear = false,
  ): Promise<{ id: string } | null> {
    if (clear) {
      return null;
    }

    if (!milestoneId) {
      return null;
    }

    const milestone = await this.prisma.milestone.findFirst({
      where: {
        tenantId,
        id: milestoneId,
        projectId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!milestone) {
      throw new BadRequestException('Invalid milestone for project');
    }

    return milestone;
  }

  private async resolveParentTask(
    tenantId: string,
    projectId: string,
    parentTaskId: string | undefined,
    clear = false,
    currentTaskId?: string,
  ): Promise<{ id: string } | null> {
    if (clear) {
      return null;
    }

    if (!parentTaskId) {
      return null;
    }

    if (currentTaskId && parentTaskId === currentTaskId) {
      throw new BadRequestException('Task cannot be parent of itself');
    }

    const parent = await this.prisma.task.findFirst({
      where: {
        tenantId,
        id: parentTaskId,
        projectId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!parent) {
      throw new BadRequestException('Invalid parent task for project');
    }

    return parent;
  }

  private async ensureTransitionAllowed(
    tenantId: string,
    projectId: string,
    fromStatusId: string,
    toStatusId: string,
  ): Promise<void> {
    if (fromStatusId === toStatusId) {
      return;
    }

    const workflow = await this.prisma.taskWorkflow.findFirst({
      where: {
        tenantId,
        projectId,
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: {
        transitions: {
          where: {
            fromStatusId,
            toStatusId,
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (!workflow) {
      return;
    }

    if (workflow.transitions.length === 0) {
      throw new BadRequestException('Workflow transition is not allowed');
    }
  }

  private assertUserUpdateFields(dto: UpdateTaskDto): void {
    const allowedFields = new Set(['statusId', 'dueDate', 'estimateHours']);

    for (const key of Object.keys(dto)) {
      const typedKey = key as keyof UpdateTaskDto;
      if (dto[typedKey] !== undefined && !allowedFields.has(key)) {
        throw new ForbiddenException(
          'USER can only update statusId, dueDate, or estimateHours',
        );
      }
    }
  }

  private shiftDueDate(currentDueDate: Date | null, shiftDays: number): Date {
    const base = currentDueDate ? new Date(currentDueDate) : new Date();
    base.setUTCDate(base.getUTCDate() + shiftDays);
    return base;
  }

  private hasRole(user: Express.User, role: Role): boolean {
    return user.roles.includes(role);
  }
}
