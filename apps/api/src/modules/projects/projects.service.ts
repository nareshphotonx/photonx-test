import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BudgetAlertsService } from '../../common/services/budget-alerts.service';
import { ProjectCostingService } from '../../common/services/project-costing.service';
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
    private readonly projectCostingService: ProjectCostingService,
    private readonly budgetAlertsService: BudgetAlertsService,
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
    const tenantCurrency = await this.getTenantCurrency(tenantId);
    const budgetCurrency = dto.budgetCurrency ?? tenantCurrency;

    if (dto.budgetAmount !== undefined && budgetCurrency !== tenantCurrency) {
      throw new BadRequestException(
        `Budget currency must match tenant currency (${tenantCurrency})`,
      );
    }

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
            budgetAmount:
              dto.budgetAmount !== undefined
                ? new Prisma.Decimal(dto.budgetAmount)
                : undefined,
            budgetCurrency: dto.budgetAmount !== undefined ? budgetCurrency : undefined,
            overheadPercent:
              dto.overheadPercent !== undefined
                ? new Prisma.Decimal(dto.overheadPercent)
                : undefined,
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
    const tenantCurrency = await this.getTenantCurrency(tenantId);

    if (
      dto.budgetCurrency !== undefined &&
      dto.budgetCurrency !== null &&
      dto.budgetCurrency !== tenantCurrency
    ) {
      throw new BadRequestException(
        `Budget currency must match tenant currency (${tenantCurrency})`,
      );
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
        budgetAmount:
          dto.budgetAmount !== undefined
            ? dto.budgetAmount === null
              ? null
              : new Prisma.Decimal(dto.budgetAmount)
            : undefined,
        budgetCurrency:
          dto.budgetCurrency !== undefined
            ? dto.budgetCurrency === null
              ? null
              : dto.budgetCurrency
            : undefined,
        overheadPercent:
          dto.overheadPercent !== undefined
            ? dto.overheadPercent === null
              ? null
              : new Prisma.Decimal(dto.overheadPercent)
            : undefined,
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
    const tenantCurrency = await this.getTenantCurrency(tenantId);

    for (const item of dto.items) {
      if (item.currency !== tenantCurrency) {
        throw new BadRequestException(
          `Project cost currency must match tenant currency (${tenantCurrency})`,
        );
      }
    }

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

    await this.budgetAlertsService.evaluateProjectBudget(tenantId, projectId, actor.sub);

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

    const [components, dailyBreakdown] = await Promise.all([
      this.projectCostingService.calculateProjectCostComponents(
        tenantId,
        projectId,
        query,
      ),
      this.projectCostingService.getDailyCostBreakdown(tenantId, projectId, query),
    ]);

    const thresholds = [
      {
        threshold: 80,
        reached:
          components.utilizationPct !== null ? components.utilizationPct >= 80 : false,
      },
      {
        threshold: 100,
        reached:
          components.utilizationPct !== null ? components.utilizationPct >= 100 : false,
      },
      {
        threshold: 120,
        reached:
          components.utilizationPct !== null ? components.utilizationPct >= 120 : false,
      },
    ];

    return {
      projectId,
      metric: 'cost_burn',
      from: query.from ?? null,
      to: query.to ?? null,
      currency: components.budgetCurrency,
      laborCost: components.laborCost,
      overheadCost: components.overheadCost,
      projectCosts: components.projectCosts,
      totalBurn: components.totalBurn,
      budgetAmount: components.budgetAmount,
      utilizationPct: components.utilizationPct,
      thresholds,
      days: dailyBreakdown,
    };
  }

  async getProjectCostSummary(
    tenantId: string,
    actor: Express.User,
    projectId: string,
    query: GetProjectBurnDto,
  ) {
    await this.scopeService.ensureProjectReadAccess(tenantId, projectId, actor);

    const [components, dailyBreakdown] = await Promise.all([
      this.projectCostingService.calculateProjectCostComponents(
        tenantId,
        projectId,
        query,
      ),
      this.projectCostingService.getDailyCostBreakdown(tenantId, projectId, query),
    ]);

    return {
      projectId,
      currency: components.budgetCurrency,
      summary: {
        laborCost: components.laborCost,
        overheadCost: components.overheadCost,
        projectCosts: components.projectCosts,
        totalCost: components.totalBurn,
      },
      budget: {
        amount: components.budgetAmount,
        utilizationPct: components.utilizationPct,
      },
      days: dailyBreakdown,
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

  private async getTenantCurrency(tenantId: string): Promise<string> {
    const settings = await this.prisma.tenantSetting.findUnique({
      where: { tenantId },
      select: { currency: true },
    });

    return settings?.currency ?? 'INR';
  }
}
