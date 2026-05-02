import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type AddTeamMembersDto } from './dto/add-team-members.dto';
import { type CreateTeamDto } from './dto/create-team.dto';
import { type ListTeamsDto } from './dto/list-teams.dto';
import { type UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createTeam(
    tenantId: string,
    actorId: string,
    dto: CreateTeamDto,
  ): Promise<{
    id: string;
    name: string;
    description: string | null;
    memberCount: number;
  }> {
    try {
      const team = await this.prisma.team.create({
        data: {
          tenantId,
          name: dto.name,
          description: dto.description,
        },
      });

      await this.auditService.log({
        tenantId,
        actorId,
        action: 'TEAM_CREATE',
        entityType: 'Team',
        entityId: team.id,
      });

      return {
        id: team.id,
        name: team.name,
        description: team.description,
        memberCount: 0,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Team name already exists in tenant');
      }

      throw error;
    }
  }

  async listTeams(tenantId: string, query: ListTeamsDto): Promise<{
    items: Array<{
      id: string;
      name: string;
      description: string | null;
      memberCount: number;
    }>;
    page: number;
    limit: number;
    total: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.TeamWhereInput = {
      tenantId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { description: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [total, teams] = await this.prisma.$transaction([
      this.prisma.team.count({ where }),
      this.prisma.team.findMany({
        where,
        include: {
          members: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items: teams.map((team) => ({
        id: team.id,
        name: team.name,
        description: team.description,
        memberCount: team.members.length,
      })),
      page,
      limit,
      total,
    };
  }

  async getTeamById(tenantId: string, teamId: string): Promise<{
    id: string;
    name: string;
    description: string | null;
    memberIds: string[];
  }> {
    const team = await this.prisma.team.findFirst({
      where: {
        tenantId,
        id: teamId,
      },
      include: {
        members: true,
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return {
      id: team.id,
      name: team.name,
      description: team.description,
      memberIds: team.members.map((entry) => entry.userId),
    };
  }

  async updateTeam(
    tenantId: string,
    actorId: string,
    teamId: string,
    dto: UpdateTeamDto,
  ): Promise<{
    id: string;
    name: string;
    description: string | null;
  }> {
    const team = await this.prisma.team.findFirst({
      where: {
        tenantId,
        id: teamId,
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    try {
      const updated = await this.prisma.team.update({
        where: { id: team.id },
        data: {
          name: dto.name,
          description: dto.description,
        },
      });

      await this.auditService.log({
        tenantId,
        actorId,
        action: 'TEAM_UPDATE',
        entityType: 'Team',
        entityId: updated.id,
        metadata: dto as Record<string, unknown>,
      });

      return {
        id: updated.id,
        name: updated.name,
        description: updated.description,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Team name already exists in tenant');
      }

      throw error;
    }
  }

  async addMembers(
    tenantId: string,
    actorId: string,
    teamId: string,
    dto: AddTeamMembersDto,
  ): Promise<{ added: number }> {
    const team = await this.prisma.team.findFirst({
      where: {
        tenantId,
        id: teamId,
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        id: { in: dto.userIds },
        deletedAt: null,
      },
      select: { id: true },
    });

    const existingIds = new Set(users.map((user) => user.id));
    const missingIds = dto.userIds.filter((id) => !existingIds.has(id));

    if (missingIds.length > 0) {
      throw new NotFoundException(`Users not found: ${missingIds.join(', ')}`);
    }

    const result = await this.prisma.teamMember.createMany({
      data: dto.userIds.map((userId) => ({
        tenantId,
        teamId,
        userId,
      })),
      skipDuplicates: true,
    });

    await this.auditService.log({
      tenantId,
      actorId,
      action: 'TEAM_MEMBERS_ADD',
      entityType: 'Team',
      entityId: teamId,
      metadata: {
        userIds: dto.userIds,
      },
    });

    return { added: result.count };
  }

  async removeMember(
    tenantId: string,
    actorId: string,
    teamId: string,
    userId: string,
  ): Promise<{ removed: boolean }> {
    const deleted = await this.prisma.teamMember.deleteMany({
      where: {
        tenantId,
        teamId,
        userId,
      },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Team member not found');
    }

    await this.auditService.log({
      tenantId,
      actorId,
      action: 'TEAM_MEMBERS_REMOVE',
      entityType: 'Team',
      entityId: teamId,
      metadata: {
        userId,
      },
    });

    return { removed: true };
  }
}
