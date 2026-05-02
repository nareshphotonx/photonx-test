import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { AuditService } from '../audit/audit.service';
import { CreateReviewEntryDto } from './dto/create-review-entry.dto';
import { ListReviewEntriesDto } from './dto/list-review-entries.dto';

@Injectable()
export class ReviewEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: TenantRbacScopeService,
    private readonly auditService: AuditService,
  ) {}

  async createReviewEntry(
    tenantId: string,
    actor: Express.User,
    dto: CreateReviewEntryDto,
  ) {
    if (!this.isTeamLead(actor)) {
      throw new ForbiddenException('Only TEAM_LEAD can create review entries');
    }

    const cycle = await this.prisma.reviewCycle.findFirst({
      where: {
        tenantId,
        id: dto.cycleId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!cycle) {
      throw new NotFoundException('Review cycle not found');
    }

    if (cycle.status === 'CLOSED') {
      throw new BadRequestException('Cannot create reviews in a closed cycle');
    }

    const reviewedUser = await this.prisma.user.findFirst({
      where: {
        tenantId,
        id: dto.reviewedUserId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!reviewedUser) {
      throw new NotFoundException('Reviewed user not found');
    }

    const leadTeamIds = await this.scopeService.getLeadTeamIds(tenantId, actor.sub);

    if (leadTeamIds.length === 0) {
      throw new ForbiddenException('TEAM_LEAD has no managed team scope');
    }

    const overlap = await this.prisma.teamMember.findFirst({
      where: {
        tenantId,
        userId: dto.reviewedUserId,
        teamId: {
          in: leadTeamIds,
        },
      },
      select: { id: true },
    });

    if (!overlap) {
      throw new ForbiddenException('TEAM_LEAD can only review own team users');
    }

    try {
      const created = await this.prisma.reviewEntry.create({
        data: {
          tenantId,
          cycleId: dto.cycleId,
          reviewedUserId: dto.reviewedUserId,
          reviewerId: actor.sub,
          overallRating: dto.overallRating,
          strengths: dto.strengths,
          improvements: dto.improvements,
          summary: dto.summary,
          status: 'DRAFT',
        },
      });

      await this.auditService.log({
        tenantId,
        actorId: actor.sub,
        action: 'REVIEW_CREATE',
        entityType: 'ReviewEntry',
        entityId: created.id,
        metadata: {
          cycleId: created.cycleId,
          reviewedUserId: created.reviewedUserId,
          overallRating: created.overallRating,
        },
      });

      return created;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new BadRequestException('Review entry already exists for this cycle/user/reviewer');
      }

      throw error;
    }
  }

  async listReviewEntries(
    tenantId: string,
    actor: Express.User,
    query: ListReviewEntriesDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ReviewEntryWhereInput = {
      tenantId,
      ...(query.cycleId ? { cycleId: query.cycleId } : {}),
      ...(query.reviewedUserId ? { reviewedUserId: query.reviewedUserId } : {}),
      ...(query.reviewerId ? { reviewerId: query.reviewerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { strengths: { contains: query.search } },
              { improvements: { contains: query.search } },
              { summary: { contains: query.search } },
            ],
          }
        : {}),
    };

    if (this.isSuperAdmin(actor)) {
      // full tenant visibility
    } else if (this.isTeamLead(actor)) {
      const leadTeamIds = await this.scopeService.getLeadTeamIds(tenantId, actor.sub);
      where.OR = [
        {
          reviewedUser: {
            teamMembership: {
              some: {
                tenantId,
                teamId: {
                  in: leadTeamIds,
                },
              },
            },
          },
        },
        {
          reviewerId: actor.sub,
        },
      ];
    } else {
      where.reviewedUserId = actor.sub;
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.reviewEntry.count({ where }),
      this.prisma.reviewEntry.findMany({
        where,
        include: {
          cycle: {
            select: {
              id: true,
              year: true,
              month: true,
              title: true,
              status: true,
            },
          },
          reviewedUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items,
      page,
      limit,
      total,
    };
  }

  async submitReviewEntry(tenantId: string, actor: Express.User, reviewId: string) {
    if (!this.isTeamLead(actor)) {
      throw new ForbiddenException('Only TEAM_LEAD can submit review entries');
    }

    const existing = await this.prisma.reviewEntry.findFirst({
      where: {
        tenantId,
        id: reviewId,
      },
      select: {
        id: true,
        reviewerId: true,
        status: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Review entry not found');
    }

    if (existing.reviewerId !== actor.sub) {
      throw new ForbiddenException('TEAM_LEAD can submit only own review entries');
    }

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT reviews can be submitted');
    }

    const updated = await this.prisma.reviewEntry.update({
      where: {
        id: existing.id,
      },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'REVIEW_SUBMIT',
      entityType: 'ReviewEntry',
      entityId: updated.id,
    });

    return updated;
  }

  async approveReviewEntry(tenantId: string, actor: Express.User, reviewId: string) {
    if (!this.isSuperAdmin(actor)) {
      throw new ForbiddenException('Only SUPER_ADMIN can approve review entries');
    }

    const existing = await this.prisma.reviewEntry.findFirst({
      where: {
        tenantId,
        id: reviewId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Review entry not found');
    }

    if (existing.status !== 'SUBMITTED') {
      throw new BadRequestException('Only SUBMITTED reviews can be approved');
    }

    const updated = await this.prisma.reviewEntry.update({
      where: {
        id: existing.id,
      },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: actor.sub,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'REVIEW_APPROVE',
      entityType: 'ReviewEntry',
      entityId: updated.id,
    });

    return updated;
  }

  private isSuperAdmin(actor: Express.User): boolean {
    return (actor.roles ?? []).includes(Role.SUPER_ADMIN);
  }

  private isTeamLead(actor: Express.User): boolean {
    return (actor.roles ?? []).includes(Role.TEAM_LEAD) && !this.isSuperAdmin(actor);
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === 'P2002';
    }

    if (!error || typeof error !== 'object') {
      return false;
    }

    return (error as { code?: string }).code === 'P2002';
  }
}
