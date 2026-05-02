import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProjectCostingService } from '../../common/services/project-costing.service';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { UserPerformanceService } from './user-performance.service';

@Injectable()
export class ProjectDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: TenantRbacScopeService,
    private readonly userPerformanceService: UserPerformanceService,
    private readonly projectCostingService: ProjectCostingService,
  ) {}

  async getProjectDashboard(
    tenantId: string,
    actor: Express.User,
    projectId: string,
    from: Date,
    to: Date,
  ) {
    await this.scopeService.ensureProjectReadAccess(tenantId, projectId, actor);

    if (this.scopeService.isEndUser(actor)) {
      throw new ForbiddenException('USER cannot access project dashboard');
    }

    const project = await this.prisma.project.findFirst({
      where: {
        tenantId,
        id: projectId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        code: true,
        billableAmount: true,
        billableCurrency: true,
      },
    });

    if (!project) {
      throw new ForbiddenException('Project not found or inaccessible');
    }

    const scopedUserIds = await this.resolveScopedProjectUsers(tenantId, actor, projectId);

    const [kpis, costs] = await Promise.all([
      this.userPerformanceService.buildScopedMetrics({
        tenantId,
        userIds: scopedUserIds,
        from,
        to,
        projectId,
      }),
      this.projectCostingService.calculateProjectCostComponents(tenantId, projectId, {
        from,
        to,
      }),
    ]);

    const billableAmount =
      project.billableAmount !== null ? Number(project.billableAmount) : null;

    const margin =
      billableAmount && billableAmount > 0
        ? Number(((billableAmount - costs.totalBurn) / billableAmount).toFixed(4))
        : null;

    return {
      project: {
        id: project.id,
        name: project.name,
        code: project.code,
      },
      range: {
        from,
        to,
      },
      kpis,
      financials: {
        laborCost: costs.laborCost,
        expenseCost: costs.projectCosts,
        overheadCost: costs.overheadCost,
        totalBurn: costs.totalBurn,
        billableAmount,
        billableCurrency: project.billableCurrency,
        margin,
      },
    };
  }

  private async resolveScopedProjectUsers(
    tenantId: string,
    actor: Express.User,
    projectId: string,
  ): Promise<string[]> {
    const members = await this.prisma.projectMember.findMany({
      where: {
        tenantId,
        projectId,
      },
      select: {
        userId: true,
      },
    });

    const projectMemberIds = Array.from(new Set(members.map((entry) => entry.userId)));

    if (this.scopeService.isSuperAdmin(actor)) {
      return projectMemberIds;
    }

    const leadTeamIds = await this.scopeService.getLeadTeamIds(tenantId, actor.sub);
    if (leadTeamIds.length === 0) {
      return [actor.sub];
    }

    const leadTeamMembers = await this.prisma.teamMember.findMany({
      where: {
        tenantId,
        teamId: { in: leadTeamIds },
      },
      select: {
        userId: true,
      },
    });

    const leadUserIds = new Set(leadTeamMembers.map((entry) => entry.userId));
    const scoped = projectMemberIds.filter((entry) => leadUserIds.has(entry));

    if (scoped.length === 0) {
      return [actor.sub];
    }

    return scoped;
  }
}
