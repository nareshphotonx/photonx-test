import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { resolveDashboardRange } from './kpi-math.util';
import { ProjectDashboardService } from './project-dashboard.service';
import { UserPerformanceService } from './user-performance.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: TenantRbacScopeService,
    private readonly userPerformanceService: UserPerformanceService,
    private readonly projectDashboardService: ProjectDashboardService,
  ) {}

  async getSuperAdminDashboard(
    tenantId: string,
    actor: Express.User,
    range: { from?: Date; to?: Date },
  ) {
    if (!this.scopeService.isSuperAdmin(actor)) {
      throw new ForbiddenException('SUPER_ADMIN access is required');
    }

    const resolved = resolveDashboardRange(range);
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    });

    const metrics = await this.userPerformanceService.buildScopedMetrics({
      tenantId,
      userIds: users.map((entry) => entry.id),
      from: resolved.from,
      to: resolved.to,
    });

    return {
      scope: 'SUPER_ADMIN',
      range: resolved,
      kpis: metrics,
    };
  }

  async getTeamLeadDashboard(
    tenantId: string,
    actor: Express.User,
    range: { from?: Date; to?: Date },
  ) {
    if (!this.scopeService.isTeamLead(actor)) {
      throw new ForbiddenException('TEAM_LEAD access is required');
    }

    const resolved = resolveDashboardRange(range);
    const leadTeamIds = await this.scopeService.getLeadTeamIds(tenantId, actor.sub);

    const members = leadTeamIds.length
      ? await this.prisma.teamMember.findMany({
          where: {
            tenantId,
            teamId: { in: leadTeamIds },
          },
          select: { userId: true },
        })
      : [];

    const scopedUserIds = Array.from(new Set(members.map((entry) => entry.userId)));

    const metrics = await this.userPerformanceService.buildScopedMetrics({
      tenantId,
      userIds: scopedUserIds,
      from: resolved.from,
      to: resolved.to,
    });

    return {
      scope: 'TEAM_LEAD',
      teamIds: leadTeamIds,
      range: resolved,
      kpis: metrics,
    };
  }

  async getUserPerformance(
    tenantId: string,
    actor: Express.User,
    userId: string,
    range: { from?: Date; to?: Date },
  ) {
    const resolved = resolveDashboardRange(range);

    if (this.scopeService.isEndUser(actor) && actor.sub !== userId) {
      throw new ForbiddenException('USER can only access own performance');
    }

    if (this.scopeService.isTeamLead(actor) && actor.sub !== userId) {
      const leadTeamIds = await this.scopeService.getLeadTeamIds(tenantId, actor.sub);
      const overlap = await this.prisma.teamMember.findFirst({
        where: {
          tenantId,
          userId,
          teamId: { in: leadTeamIds },
        },
      });

      if (!overlap) {
        throw new ForbiddenException('TEAM_LEAD can only access own team performance');
      }
    }

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        id: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      throw new ForbiddenException('User not found or inaccessible');
    }

    const metrics = await this.userPerformanceService.buildScopedMetrics({
      tenantId,
      userIds: [user.id],
      from: resolved.from,
      to: resolved.to,
    });

    return {
      scope: 'USER_PERFORMANCE',
      user,
      range: resolved,
      kpis: metrics,
    };
  }

  async getProjectDashboard(
    tenantId: string,
    actor: Express.User,
    projectId: string,
    range: { from?: Date; to?: Date },
  ) {
    const resolved = resolveDashboardRange(range);
    return this.projectDashboardService.getProjectDashboard(
      tenantId,
      actor,
      projectId,
      resolved.from,
      resolved.to,
    );
  }
}
