import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { AuditService } from '../audit/audit.service';
import { CreateTaskStatusDto } from './dto/create-task-status.dto';
import { ListTaskStatusesDto } from './dto/list-task-statuses.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

@Injectable()
export class TaskStatusesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: TenantRbacScopeService,
    private readonly auditService: AuditService,
  ) {}

  async createStatus(tenantId: string, actor: Express.User, dto: CreateTaskStatusDto) {
    if (this.scopeService.isEndUser(actor)) {
      throw new ForbiddenException('USER cannot create task statuses');
    }

    await this.scopeService.ensureProjectManageAccess(tenantId, dto.projectId, actor);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        if (dto.isDefault) {
          await tx.taskStatus.updateMany({
            where: {
              tenantId,
              projectId: dto.projectId,
            },
            data: {
              isDefault: false,
            },
          });
        }

        return tx.taskStatus.create({
          data: {
            tenantId,
            projectId: dto.projectId,
            name: dto.name,
            code: dto.code,
            description: dto.description,
            color: dto.color,
            position: dto.position ?? 0,
            isDone: dto.isDone ?? false,
            requiresLocation: dto.requiresLocation ?? false,
            requiresSelfie: dto.requiresSelfie ?? false,
            isDefault: dto.isDefault ?? false,
            createdBy: actor.sub,
            updatedBy: actor.sub,
          },
        });
      });

      await this.auditService.log({
        tenantId,
        actorId: actor.sub,
        action: 'TASK_STATUS_CREATE',
        entityType: 'TaskStatus',
        entityId: created.id,
      });

      return created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Task status code already exists in project');
      }

      throw error;
    }
  }

  async listStatuses(tenantId: string, actor: Express.User, query: ListTaskStatusesDto) {
    await this.scopeService.ensureProjectReadAccess(tenantId, query.projectId, actor);

    return this.prisma.taskStatus.findMany({
      where: {
        tenantId,
        projectId: query.projectId,
        deletedAt: null,
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async updateStatus(
    tenantId: string,
    actor: Express.User,
    statusId: string,
    dto: UpdateTaskStatusDto,
  ) {
    const existing = await this.prisma.taskStatus.findFirst({
      where: {
        tenantId,
        id: statusId,
        deletedAt: null,
      },
      select: {
        id: true,
        projectId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Task status not found');
    }

    if (this.scopeService.isEndUser(actor)) {
      throw new ForbiddenException('USER cannot update task statuses');
    }

    await this.scopeService.ensureProjectManageAccess(
      tenantId,
      existing.projectId,
      actor,
    );

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (dto.isDefault) {
          await tx.taskStatus.updateMany({
            where: {
              tenantId,
              projectId: existing.projectId,
            },
            data: {
              isDefault: false,
            },
          });
        }

        return tx.taskStatus.update({
          where: { id: existing.id },
          data: {
            name: dto.name,
            code: dto.code,
            description: dto.description,
            color: dto.color,
            position: dto.position,
            isDone: dto.isDone,
            requiresLocation: dto.requiresLocation,
            requiresSelfie: dto.requiresSelfie,
            isDefault: dto.isDefault,
            updatedBy: actor.sub,
          },
        });
      });

      await this.auditService.log({
        tenantId,
        actorId: actor.sub,
        action: 'TASK_STATUS_UPDATE',
        entityType: 'TaskStatus',
        entityId: existing.id,
        metadata: dto as Record<string, unknown>,
      });

      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Task status code already exists in project');
      }

      throw error;
    }
  }

  async deleteStatus(
    tenantId: string,
    actor: Express.User,
    statusId: string,
  ): Promise<{ deleted: boolean }> {
    const existing = await this.prisma.taskStatus.findFirst({
      where: {
        tenantId,
        id: statusId,
        deletedAt: null,
      },
      select: {
        id: true,
        projectId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Task status not found');
    }

    if (this.scopeService.isEndUser(actor)) {
      throw new ForbiddenException('USER cannot delete task statuses');
    }

    await this.scopeService.ensureProjectManageAccess(
      tenantId,
      existing.projectId,
      actor,
    );

    const tasksUsingStatus = await this.prisma.task.count({
      where: {
        tenantId,
        taskStatusId: statusId,
        deletedAt: null,
      },
    });

    if (tasksUsingStatus > 0) {
      throw new BadRequestException('Cannot delete task status in use by tasks');
    }

    await this.prisma.taskStatus.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
        updatedBy: actor.sub,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'TASK_STATUS_DELETE',
      entityType: 'TaskStatus',
      entityId: existing.id,
    });

    return { deleted: true };
  }
}
