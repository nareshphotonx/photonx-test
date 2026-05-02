import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { Role } from '../enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';

interface AccessUser {
  sub: string;
  tenantId: string;
  roles: string[];
}

@Injectable()
export class TenantRbacScopeService {
  constructor(private readonly prisma: PrismaService) {}

  isSuperAdmin(user: AccessUser): boolean {
    return user.roles.includes(Role.SUPER_ADMIN);
  }

  isTeamLead(user: AccessUser): boolean {
    return !this.isSuperAdmin(user) && user.roles.includes(Role.TEAM_LEAD);
  }

  isEndUser(user: AccessUser): boolean {
    return !this.isSuperAdmin(user) && !this.isTeamLead(user);
  }

  async ensureProjectReadAccess(
    tenantId: string,
    projectId: string,
    user: AccessUser,
  ): Promise<{ id: string; teamId: string | null; code: string }> {
    const project = await this.prisma.project.findFirst({
      where: {
        tenantId,
        id: projectId,
        deletedAt: null,
      },
      select: {
        id: true,
        teamId: true,
        code: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (this.isSuperAdmin(user)) {
      return project;
    }

    if (this.isTeamLead(user)) {
      const membership = await this.prisma.projectMember.findFirst({
        where: {
          tenantId,
          projectId,
          userId: user.sub,
        },
      });

      if (!membership) {
        throw new ForbiddenException('TEAM_LEAD can only access own projects');
      }

      return project;
    }

    const assignedTask = await this.prisma.task.findFirst({
      where: {
        tenantId,
        projectId,
        assigneeId: user.sub,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!assignedTask) {
      throw new ForbiddenException('USER can only access assigned project context');
    }

    return project;
  }

  async ensureProjectManageAccess(
    tenantId: string,
    projectId: string,
    user: AccessUser,
  ): Promise<{ id: string; teamId: string | null; code: string }> {
    if (this.isEndUser(user)) {
      throw new ForbiddenException('USER cannot manage projects');
    }

    return this.ensureProjectReadAccess(tenantId, projectId, user);
  }

  async ensureTaskReadAccess(
    tenantId: string,
    taskId: string,
    user: AccessUser,
  ): Promise<Prisma.TaskGetPayload<{
    include: {
      status: true;
      assignee: {
        include: {
          teamMembership: {
            select: {
              teamId: true;
            };
          };
        };
      };
      project: {
        select: {
          id: true;
          code: true;
        };
      };
    };
  }>> {
    const task = await this.prisma.task.findFirst({
      where: {
        tenantId,
        id: taskId,
        deletedAt: null,
      },
      include: {
        status: true,
        assignee: {
          include: {
            teamMembership: {
              where: { tenantId },
              select: {
                teamId: true,
              },
            },
          },
        },
        project: {
          select: {
            id: true,
            code: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (this.isSuperAdmin(user)) {
      return task;
    }

    if (this.isEndUser(user)) {
      if (task.assigneeId !== user.sub) {
        throw new ForbiddenException('USER can only access assigned tasks');
      }

      return task;
    }

    const [membership, leadTeamIds] = await Promise.all([
      this.prisma.projectMember.findFirst({
        where: {
          tenantId,
          projectId: task.projectId,
          userId: user.sub,
        },
      }),
      this.getLeadTeamIds(tenantId, user.sub),
    ]);

    if (!membership) {
      throw new ForbiddenException('TEAM_LEAD can only access own project tasks');
    }

    if (!task.assigneeId) {
      return task;
    }

    const assigneeTeamIds = task.assignee?.teamMembership.map(
      (entry) => entry.teamId,
    );

    const hasOverlap = assigneeTeamIds?.some((teamId) =>
      leadTeamIds.includes(teamId),
    );

    if (!hasOverlap) {
      throw new ForbiddenException(
        'TEAM_LEAD task access requires project membership and team overlap',
      );
    }

    return task;
  }

  async ensureTaskManageAccess(
    tenantId: string,
    taskId: string,
    user: AccessUser,
  ): Promise<Prisma.TaskGetPayload<{
    include: {
      status: true;
      assignee: {
        include: {
          teamMembership: {
            select: {
              teamId: true;
            };
          };
        };
      };
      project: {
        select: {
          id: true;
          code: true;
        };
      };
    };
  }>> {
    return this.ensureTaskReadAccess(tenantId, taskId, user);
  }

  async getLeadTeamIds(tenantId: string, userId: string): Promise<string[]> {
    const rows = await this.prisma.teamMember.findMany({
      where: {
        tenantId,
        userId,
      },
      select: {
        teamId: true,
      },
    });

    return rows.map((row) => row.teamId);
  }
}
