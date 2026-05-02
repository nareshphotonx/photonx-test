import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalTargetType,
  AttachmentEntityType,
  ExpenseStatus,
  Prisma,
} from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateExpensePolicyDto } from './dto/create-expense-policy.dto';
import { ExpenseActionDto } from './dto/expense-action.dto';
import { ListExpensesDto } from './dto/list-expenses.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly approvalsService: ApprovalsService,
  ) {}

  async createCategory(
    tenantId: string,
    actor: Express.User,
    dto: CreateExpenseCategoryDto,
  ) {
    this.assertNotEndUser(actor);

    try {
      const created = await this.prisma.expenseCategory.create({
        data: {
          tenantId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name,
          description: dto.description,
          capAmount:
            dto.capAmount !== undefined ? new Prisma.Decimal(dto.capAmount) : undefined,
          isActive: dto.isActive ?? true,
        },
      });

      await this.auditService.log({
        tenantId,
        actorId: actor.sub,
        action: 'EXPENSE_CATEGORY_CREATE',
        entityType: 'ExpenseCategory',
        entityId: created.id,
        metadata: dto as unknown as Record<string, unknown>,
      });

      return created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Expense category code already exists in tenant');
      }

      throw error;
    }
  }

  async listCategories(tenantId: string) {
    return this.prisma.expenseCategory.findMany({
      where: { tenantId },
      include: {
        policies: true,
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createPolicy(
    tenantId: string,
    actor: Express.User,
    dto: CreateExpensePolicyDto,
  ) {
    this.assertNotEndUser(actor);

    const category = await this.prisma.expenseCategory.findFirst({
      where: {
        tenantId,
        id: dto.categoryId,
      },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Expense category not found');
    }

    const policy = await this.prisma.expensePolicy.upsert({
      where: {
        tenantId_categoryId: {
          tenantId,
          categoryId: dto.categoryId,
        },
      },
      create: {
        tenantId,
        categoryId: dto.categoryId,
        categoryCap:
          dto.categoryCap !== undefined ? new Prisma.Decimal(dto.categoryCap) : undefined,
        requireApproval: dto.requireApproval ?? true,
      },
      update: {
        categoryCap:
          dto.categoryCap !== undefined ? new Prisma.Decimal(dto.categoryCap) : null,
        requireApproval: dto.requireApproval ?? true,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'EXPENSE_POLICY_UPSERT',
      entityType: 'ExpensePolicy',
      entityId: policy.id,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return policy;
  }

  async createExpense(
    tenantId: string,
    actor: Express.User,
    dto: CreateExpenseDto,
  ) {
    const [project, category, policy, tenantSettings] = await Promise.all([
      this.prisma.project.findFirst({
        where: {
          tenantId,
          id: dto.projectId,
          deletedAt: null,
        },
        select: { id: true },
      }),
      this.prisma.expenseCategory.findFirst({
        where: {
          tenantId,
          id: dto.categoryId,
          isActive: true,
        },
        select: {
          id: true,
          capAmount: true,
        },
      }),
      this.prisma.expensePolicy.findUnique({
        where: {
          tenantId_categoryId: {
            tenantId,
            categoryId: dto.categoryId,
          },
        },
        select: {
          id: true,
          categoryCap: true,
          requireApproval: true,
        },
      }),
      this.prisma.tenantSetting.findUnique({
        where: { tenantId },
        select: { currency: true },
      }),
    ]);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!category) {
      throw new NotFoundException('Expense category not found');
    }

    const tenantCurrency = tenantSettings?.currency ?? 'INR';
    if (dto.currency !== tenantCurrency) {
      throw new BadRequestException(
        `Expense currency (${dto.currency}) must match tenant currency (${tenantCurrency})`,
      );
    }

    const cap = Number(policy?.categoryCap ?? category.capAmount ?? 0);
    if (cap > 0 && dto.amount > cap) {
      throw new BadRequestException(`Expense exceeds category cap (${cap})`);
    }

    if (dto.receiptAttachmentId) {
      const attachment = await this.prisma.taskAttachment.findFirst({
        where: {
          tenantId,
          id: dto.receiptAttachmentId,
          uploaderId: actor.sub,
          projectId: dto.projectId,
        },
        select: {
          id: true,
          entityType: true,
        },
      });

      if (!attachment) {
        throw new BadRequestException('Invalid receipt attachment for tenant scope');
      }

      if (attachment.entityType !== AttachmentEntityType.EXPENSE) {
        throw new BadRequestException('Receipt attachment must use EXPENSE entity type');
      }
    }

    const expense = await this.prisma.expense.create({
      data: {
        tenantId,
        userId: actor.sub,
        projectId: dto.projectId,
        categoryId: dto.categoryId,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency,
        expenseDate: dto.expenseDate,
        description: dto.description,
        receiptAttachmentId: dto.receiptAttachmentId,
        status: ExpenseStatus.PENDING,
      },
    });

    if (dto.receiptAttachmentId) {
      await this.prisma.taskAttachment.update({
        where: { id: dto.receiptAttachmentId },
        data: {
          entityId: expense.id,
        },
      });
    }

    const approval = await this.approvalsService.createSingleStepApproval({
      tenantId,
      targetType: ApprovalTargetType.EXPENSE,
      targetId: expense.id,
      requesterId: actor.sub,
    });

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'EXPENSE_CREATE',
      entityType: 'Expense',
      entityId: expense.id,
      metadata: {
        approvalRequestId: approval.approvalRequestId,
      },
    });

    return {
      ...expense,
      approvalRequestId: approval.approvalRequestId,
    };
  }

  async listExpenses(tenantId: string, actor: Express.User, query: ListExpensesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ExpenseWhereInput = {
      tenantId,
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            expenseDate: {
              gte: query.from,
              lte: query.to,
            },
          }
        : {}),
    };

    if (this.isEndUser(actor)) {
      where.userId = actor.sub;
    }

    if (this.isTeamLead(actor)) {
      const leadTeamIds = await this.getLeadTeamIds(tenantId, actor.sub);
      where.OR = [
        {
          user: {
            teamMembership: {
              some: {
                tenantId,
                teamId: { in: leadTeamIds },
              },
            },
          },
        },
        { userId: actor.sub },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
          category: {
            select: { id: true, code: true, name: true },
          },
          project: {
            select: { id: true, code: true, name: true },
          },
          receiptAttachment: {
            select: {
              id: true,
              s3Key: true,
              fileName: true,
              contentType: true,
              url: true,
            },
          },
        },
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
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

  async getExpenseById(tenantId: string, actor: Express.User, expenseId: string) {
    const expense = await this.prisma.expense.findFirst({
      where: {
        tenantId,
        id: expenseId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
        category: {
          select: { id: true, code: true, name: true },
        },
        project: {
          select: { id: true, code: true, name: true },
        },
        receiptAttachment: {
          select: {
            id: true,
            s3Key: true,
            fileName: true,
            contentType: true,
            url: true,
          },
        },
      },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    if (this.isEndUser(actor) && expense.userId !== actor.sub) {
      throw new ForbiddenException('USER can only access own expenses');
    }

    if (this.isTeamLead(actor) && expense.userId !== actor.sub) {
      const leadTeamIds = await this.getLeadTeamIds(tenantId, actor.sub);
      const targetTeams = await this.prisma.teamMember.findMany({
        where: {
          tenantId,
          userId: expense.userId,
        },
        select: { teamId: true },
      });
      const overlap = targetTeams.some((entry) => leadTeamIds.includes(entry.teamId));
      if (!overlap) {
        throw new ForbiddenException('TEAM_LEAD can only access own team expenses');
      }
    }

    return expense;
  }

  async approveExpense(
    tenantId: string,
    actor: Express.User,
    expenseId: string,
    dto: ExpenseActionDto,
  ) {
    const approval = await this.approvalsService.getByTarget(
      tenantId,
      ApprovalTargetType.EXPENSE,
      expenseId,
    );

    if (!approval) {
      throw new NotFoundException('Approval request not found for expense');
    }

    return this.approvalsService.approve(tenantId, actor, approval.id, {
      reason: dto.reason,
    });
  }

  async rejectExpense(
    tenantId: string,
    actor: Express.User,
    expenseId: string,
    dto: ExpenseActionDto,
  ) {
    const approval = await this.approvalsService.getByTarget(
      tenantId,
      ApprovalTargetType.EXPENSE,
      expenseId,
    );

    if (!approval) {
      throw new NotFoundException('Approval request not found for expense');
    }

    return this.approvalsService.reject(tenantId, actor, approval.id, {
      reason: dto.reason,
    });
  }

  private assertNotEndUser(actor: Express.User): void {
    if (this.isEndUser(actor)) {
      throw new ForbiddenException('USER cannot perform this action');
    }
  }

  private isSuperAdmin(actor: Express.User): boolean {
    return actor.roles.includes(Role.SUPER_ADMIN);
  }

  private isTeamLead(actor: Express.User): boolean {
    return !this.isSuperAdmin(actor) && actor.roles.includes(Role.TEAM_LEAD);
  }

  private isEndUser(actor: Express.User): boolean {
    return !this.isSuperAdmin(actor) && !this.isTeamLead(actor);
  }

  private async getLeadTeamIds(tenantId: string, userId: string): Promise<string[]> {
    const rows = await this.prisma.teamMember.findMany({
      where: {
        tenantId,
        userId,
      },
      select: { teamId: true },
    });

    return rows.map((entry) => entry.teamId);
  }
}
