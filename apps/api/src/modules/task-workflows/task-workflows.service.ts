import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { AuditService } from '../audit/audit.service';
import { CreateTaskWorkflowDto } from './dto/create-task-workflow.dto';
import { ListTaskWorkflowsDto } from './dto/list-task-workflows.dto';

@Injectable()
export class TaskWorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: TenantRbacScopeService,
    private readonly auditService: AuditService,
  ) {}

  async createWorkflow(
    tenantId: string,
    actor: Express.User,
    dto: CreateTaskWorkflowDto,
  ) {
    if (this.scopeService.isEndUser(actor)) {
      throw new ForbiddenException('USER cannot create task workflows');
    }

    await this.scopeService.ensureProjectManageAccess(tenantId, dto.projectId, actor);

    const uniqueStatusIds = Array.from(
      new Set(
        dto.transitions.flatMap((transition) => [
          transition.fromStatusId,
          transition.toStatusId,
        ]),
      ),
    );

    const statuses = await this.prisma.taskStatus.findMany({
      where: {
        tenantId,
        projectId: dto.projectId,
        id: {
          in: uniqueStatusIds,
        },
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (statuses.length !== uniqueStatusIds.length) {
      throw new BadRequestException('One or more transition statuses are invalid');
    }

    try {
      const workflow = await this.prisma.$transaction(async (tx) => {
        if (dto.isDefault) {
          await tx.taskWorkflow.updateMany({
            where: {
              tenantId,
              projectId: dto.projectId,
            },
            data: {
              isDefault: false,
            },
          });
        }

        const created = await tx.taskWorkflow.create({
          data: {
            tenantId,
            projectId: dto.projectId,
            name: dto.name,
            isDefault: dto.isDefault ?? false,
            createdBy: actor.sub,
            updatedBy: actor.sub,
          },
        });

        await tx.taskWorkflowTransition.createMany({
          data: dto.transitions.map((transition) => ({
            tenantId,
            projectId: dto.projectId,
            workflowId: created.id,
            fromStatusId: transition.fromStatusId,
            toStatusId: transition.toStatusId,
          })),
        });

        return created;
      });

      await this.auditService.log({
        tenantId,
        actorId: actor.sub,
        action: 'TASK_WORKFLOW_CREATE',
        entityType: 'TaskWorkflow',
        entityId: workflow.id,
        metadata: {
          projectId: dto.projectId,
          transitionCount: dto.transitions.length,
        },
      });

      return workflow;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Workflow name already exists in project');
      }

      throw error;
    }
  }

  async listWorkflows(
    tenantId: string,
    actor: Express.User,
    query: ListTaskWorkflowsDto,
  ) {
    await this.scopeService.ensureProjectReadAccess(tenantId, query.projectId, actor);

    return this.prisma.taskWorkflow.findMany({
      where: {
        tenantId,
        projectId: query.projectId,
      },
      include: {
        transitions: {
          include: {
            fromStatus: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            toStatus: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }
}
