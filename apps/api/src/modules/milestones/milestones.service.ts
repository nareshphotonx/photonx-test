import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MilestoneStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { AuditService } from '../audit/audit.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';

@Injectable()
export class MilestonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: TenantRbacScopeService,
    private readonly auditService: AuditService,
  ) {}

  async createMilestone(
    tenantId: string,
    actor: Express.User,
    dto: CreateMilestoneDto,
  ) {
    if (this.scopeService.isEndUser(actor)) {
      throw new ForbiddenException('USER cannot create milestones');
    }

    await this.scopeService.ensureProjectManageAccess(tenantId, dto.projectId, actor);

    const created = await this.prisma.milestone.create({
      data: {
        tenantId,
        projectId: dto.projectId,
        name: dto.name,
        description: dto.description,
        status: dto.status ?? MilestoneStatus.PLANNED,
        startDate: dto.startDate,
        dueDate: dto.dueDate,
        createdBy: actor.sub,
        updatedBy: actor.sub,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'MILESTONE_CREATE',
      entityType: 'Milestone',
      entityId: created.id,
      metadata: {
        projectId: dto.projectId,
      },
    });

    return created;
  }

  async listProjectMilestones(
    tenantId: string,
    actor: Express.User,
    projectId: string,
  ) {
    await this.scopeService.ensureProjectReadAccess(tenantId, projectId, actor);

    const milestones = await this.prisma.milestone.findMany({
      where: {
        tenantId,
        projectId,
        deletedAt: null,
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });

    return milestones;
  }

  async getMilestoneById(tenantId: string, actor: Express.User, milestoneId: string) {
    const milestone = await this.prisma.milestone.findFirst({
      where: {
        tenantId,
        id: milestoneId,
        deletedAt: null,
      },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    await this.scopeService.ensureProjectReadAccess(
      tenantId,
      milestone.projectId,
      actor,
    );

    return milestone;
  }

  async updateMilestone(
    tenantId: string,
    actor: Express.User,
    milestoneId: string,
    dto: UpdateMilestoneDto,
  ) {
    const milestone = await this.prisma.milestone.findFirst({
      where: {
        tenantId,
        id: milestoneId,
        deletedAt: null,
      },
      select: {
        id: true,
        projectId: true,
      },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    await this.scopeService.ensureProjectManageAccess(
      tenantId,
      milestone.projectId,
      actor,
    );

    const status = dto.status;
    const completedAt =
      status === MilestoneStatus.COMPLETED
        ? (dto.completedAt ?? new Date())
        : dto.completedAt;

    const updated = await this.prisma.milestone.update({
      where: { id: milestone.id },
      data: {
        name: dto.name,
        description: dto.description,
        status,
        startDate: dto.startDate,
        dueDate: dto.dueDate,
        completedAt,
        updatedBy: actor.sub,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'MILESTONE_UPDATE',
      entityType: 'Milestone',
      entityId: milestone.id,
      metadata: dto as Record<string, unknown>,
    });

    return updated;
  }

  async deleteMilestone(
    tenantId: string,
    actor: Express.User,
    milestoneId: string,
  ): Promise<{ deleted: boolean }> {
    const milestone = await this.prisma.milestone.findFirst({
      where: {
        tenantId,
        id: milestoneId,
        deletedAt: null,
      },
      select: {
        id: true,
        projectId: true,
      },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    await this.scopeService.ensureProjectManageAccess(
      tenantId,
      milestone.projectId,
      actor,
    );

    await this.prisma.milestone.update({
      where: { id: milestone.id },
      data: {
        deletedAt: new Date(),
        status: MilestoneStatus.CANCELLED,
        updatedBy: actor.sub,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'MILESTONE_DELETE',
      entityType: 'Milestone',
      entityId: milestone.id,
    });

    return { deleted: true };
  }
}
