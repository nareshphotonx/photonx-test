import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateReviewCycleDto } from './dto/create-review-cycle.dto';
import { ListReviewCyclesDto } from './dto/list-review-cycles.dto';

@Injectable()
export class ReviewCyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createReviewCycle(
    tenantId: string,
    actor: Express.User,
    dto: CreateReviewCycleDto,
  ) {
    if (!this.isAdminOrLead(actor)) {
      throw new ForbiddenException('Only TEAM_LEAD or SUPER_ADMIN can create review cycles');
    }

    if (dto.startDate && dto.endDate && dto.endDate < dto.startDate) {
      throw new BadRequestException('endDate must be greater than or equal to startDate');
    }

    const title = dto.title ?? this.defaultTitle(dto.year, dto.month);

    try {
      const created = await this.prisma.reviewCycle.create({
        data: {
          tenantId,
          year: dto.year,
          month: dto.month,
          title,
          status: 'OPEN',
          startDate: dto.startDate,
          endDate: dto.endDate,
          notes: dto.notes,
          createdById: actor.sub,
        },
      });

      await this.auditService.log({
        tenantId,
        actorId: actor.sub,
        action: 'REVIEW_CYCLE_CREATE',
        entityType: 'ReviewCycle',
        entityId: created.id,
        metadata: {
          year: created.year,
          month: created.month,
          status: created.status,
        },
      });

      return created;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new BadRequestException('Review cycle already exists for this month');
      }

      throw error;
    }
  }

  async listReviewCycles(tenantId: string, query: ListReviewCyclesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ReviewCycleWhereInput = {
      tenantId,
      ...(query.year ? { year: query.year } : {}),
      ...(query.month ? { month: query.month } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search } },
              { notes: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.reviewCycle.count({ where }),
      this.prisma.reviewCycle.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              entries: true,
            },
          },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
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

  private defaultTitle(year: number, month: number): string {
    const monthLabel = String(month).padStart(2, '0');
    return `Review Cycle ${year}-${monthLabel}`;
  }

  private isAdminOrLead(actor: Express.User): boolean {
    const roles = actor.roles ?? [];
    return roles.includes(Role.SUPER_ADMIN) || roles.includes(Role.TEAM_LEAD);
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
