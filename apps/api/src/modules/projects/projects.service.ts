import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { AuditService } from '../audit/audit.service';
import { AddProjectCostsDto } from './dto/add-project-costs.dto';
import { AddProjectMembersDto } from './dto/add-project-members.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { GetProjectBurnDto } from './dto/get-project-burn.dto';
import { ListProjectsDto } from './dto/list-projects.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly scopeService: TenantRbacScopeService,
  ) {}

  async createProject(
    tenantId: string,
    actor: Express.User,
    dto: CreateProjectDto,
  ): Promise<{
    id: string;
    name: string;
    code: string;
    status: ProjectStatus;
    teamId: string | null;
  }> {
    if (this.scopeService.isEndUser(actor)) {
      throw new ForbiddenException('USER cannot create projects');
    }

    const code = this.normalizeCode(dto.code);

    await this.assertTeamInTenant(tenantId, dto.teamId);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: {
            tenantId,
            name: dto.name,
            code,
            description: dto.description,
            teamId: dto.teamId,
            status: dto.status ?? ProjectStatus.ACTIVE,
            startDate: dto.startDate,
            endDate: dto.endDate,
            createdBy: actor.sub,
            updatedBy: actor.sub,
          },
        });

        await tx.projectMember.create({
          data: {
            tenantId,
            projectId: project.id,
            userId: actor.sub,
            role: 'OWNER',
          },
        });

        return project;
      });

      await this.auditService.log({
        tenantId,
        actorId: actor.sub,
        action: 'PROJECT_CREATE',
        entityType: 'Project',
        entityId: created.id,
        metadata: {
          code: created.code,
          teamId: created.teamId,
        },
      });

      return {
        id: created.id,
        name: created.name,
        code: created.code,
        status: created.status,
        teamId: created.teamId,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Project code already exists in tenant');
      }

      throw error;
    }
  }

  async listProjects(tenantId: string, actor: Express.User, query: ListProjectsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ProjectWhereInput = {
      tenantId,
      deletedAt: query.includeDeleted ? undefined : null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { code: { contains: query.search } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.teamId ? { teamId: query.teamId } : {}),
    };

    if (this.scopeService.isTeamLead(actor)) {
      where.members = {
        some: {
          tenantId,
          userId: actor.sub,
        },
      };
    }

    if (this.scopeService.isEndUser(actor)) {
      where.tasks = {
        some: {
          tenantId,
          assigneeId: actor.sub,
          deletedAt: null,
        },
      };
    }

    const [total, projects] = await this.prisma.$transaction([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        include: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              tasks: {
                where: {
                  deletedAt: null,
                },
              },
              members: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: projects.map((project) => ({
        id: project.id,
        name: project.name,
        code: project.code,
        status: project.status,
        team: project.team,
        taskCount: project._count.tasks,
        memberCount: project._count.members,
        createdAt: project.createdAt,
      })),
      page,
      limit,
      total,
    };
  }

  async getProjectById(tenantId: string, actor: Express.User, projectId: string) {
    await this.scopeService.ensureProjectReadAccess(tenantId, projectId, actor);

    const project = await this.prisma.project.findFirst({
      where: {
        tenantId,
        id: projectId,
        deletedAt: null,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return {
      id: project.id,
      name: project.name,
      code: project.code,
      description: project.description,
      status: project.status,
      team: project.team,
      startDate: project.startDate,
      endDate: project.endDate,
      members: project.members.map((entry) => ({
        id: entry.id,
        role: entry.role,
        user: entry.user,
      })),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  async updateProject(
    tenantId: string,
    actor: Express.User,
    projectId: string,
    dto: UpdateProjectDto,
  ) {
    await this.scopeService.ensureProjectManageAccess(tenantId, projectId, actor);

    await this.assertTeamInTenant(tenantId, dto.teamId ?? undefined);

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
        startDate: dto.startDate,
        endDate: dto.endDate,
        teamId: dto.teamId,
        updatedBy: actor.sub,
      },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        teamId: true,
        startDate: true,
        endDate: true,
        updatedAt: true,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'PROJECT_UPDATE',
      entityType: 'Project',
      entityId: projectId,
      metadata: dto as Record<string, unknown>,
    });

    return updated;
  }

  async deleteProject(
    tenantId: string,
    actor: Express.User,
    projectId: string,
  ): Promise<{ deleted: boolean }> {
    await this.scopeService.ensureProjectManageAccess(tenantId, projectId, actor);

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        deletedAt: new Date(),
        status: ProjectStatus.ARCHIVED,
        updatedBy: actor.sub,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'PROJECT_DELETE',
      entityType: 'Project',
      entityId: projectId,
    });

    return { deleted: true };
  }

  async addProjectMembers(
    tenantId: string,
    actor: Express.User,
    projectId: string,
    dto: AddProjectMembersDto,
  ): Promise<{ projectId: string; added: number }> {
    await this.scopeService.ensureProjectManageAccess(tenantId, projectId, actor);

    const userIds = Array.from(new Set(dto.members.map((entry) => entry.userId)));

    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        id: { in: userIds },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (users.length !== userIds.length) {
      throw new BadRequestException('One or more users are invalid for tenant');
    }

    await this.prisma.projectMember.createMany({
      data: dto.members.map((member) => ({
        tenantId,
        projectId,
        userId: member.userId,
        role: member.role,
      })),
      skipDuplicates: true,
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'PROJECT_MEMBERS_ADD',
      entityType: 'Project',
      entityId: projectId,
      metadata: {
        members: dto.members,
      },
    });

    return {
      projectId,
      added: dto.members.length,
    };
  }

  async addProjectCosts(
    tenantId: string,
    actor: Express.User,
    projectId: string,
    dto: AddProjectCostsDto,
  ): Promise<{ projectId: string; added: number }> {
    await this.scopeService.ensureProjectManageAccess(tenantId, projectId, actor);

    await this.prisma.projectCost.createMany({
      data: dto.items.map((item) => ({
        tenantId,
        projectId,
        amount: new Prisma.Decimal(item.amount),
        currency: item.currency,
        category: item.category,
        costDate: item.costDate,
        note: item.note,
        createdBy: actor.sub,
      })),
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'PROJECT_COST_ADD',
      entityType: 'Project',
      entityId: projectId,
      metadata: {
        items: dto.items,
      },
    });

    return {
      projectId,
      added: dto.items.length,
    };
  }

  async getProjectBurn(
    tenantId: string,
    actor: Express.User,
    projectId: string,
    query: GetProjectBurnDto,
  ) {
    await this.scopeService.ensureProjectReadAccess(tenantId, projectId, actor);

    const tasks = await this.prisma.task.findMany({
      where: {
        tenantId,
        projectId,
        deletedAt: null,
        ...(query.from || query.to
          ? {
              createdAt: {
                gte: query.from,
                lte: query.to,
              },
            }
          : {}),
      },
      include: {
        status: {
          select: {
            isDone: true,
          },
        },
      },
    });

    const byDate = new Map<string, { estimatedHours: number; completedHours: number }>();

    for (const task of tasks) {
      const estimate = Number(task.estimateHours ?? 0);
      const createdDateKey = task.createdAt.toISOString().slice(0, 10);

      const existingEstimate = byDate.get(createdDateKey) ?? {
        estimatedHours: 0,
        completedHours: 0,
      };

      existingEstimate.estimatedHours += estimate;
      byDate.set(createdDateKey, existingEstimate);

      if (task.status.isDone) {
        const completedDateKey = task.updatedAt.toISOString().slice(0, 10);
        const existingCompleted = byDate.get(completedDateKey) ?? {
          estimatedHours: 0,
          completedHours: 0,
        };

        existingCompleted.completedHours += estimate;
        byDate.set(completedDateKey, existingCompleted);
      }
    }

    const points = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({
        date,
        estimatedHours: Number(values.estimatedHours.toFixed(2)),
        completedHours: Number(values.completedHours.toFixed(2)),
      }));

    return {
      projectId,
      metric: 'estimated_vs_completed_hours_daily',
      points,
    };
  }

  private normalizeCode(code: string): string {
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

    if (!normalized) {
      throw new BadRequestException('Project code must contain letters or numbers');
    }

    return normalized;
  }

  private async assertTeamInTenant(
    tenantId: string,
    teamId: string | undefined,
  ): Promise<void> {
    if (!teamId) {
      return;
    }

    const team = await this.prisma.team.findFirst({
      where: {
        tenantId,
        id: teamId,
      },
      select: { id: true },
    });

    if (!team) {
      throw new BadRequestException('Invalid teamId for tenant');
    }
  }
}
