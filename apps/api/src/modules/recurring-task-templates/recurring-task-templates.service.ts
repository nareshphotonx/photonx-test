import { Injectable, Logger } from '@nestjs/common';
import { Prisma, RecurringFrequency, TaskPriority } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RecurringTaskTemplatesService {
  private readonly logger = new Logger(RecurringTaskTemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async processDueTemplates(now: Date): Promise<void> {
    const templates = await this.prisma.recurringTaskTemplate.findMany({
      where: {
        isActive: true,
        nextRunAt: {
          lte: now,
        },
      },
      select: {
        id: true,
      },
      take: 50,
      orderBy: {
        nextRunAt: 'asc',
      },
    });

    for (const row of templates) {
      await this.processTemplate(row.id, now);
    }
  }

  private async processTemplate(templateId: string, now: Date): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const template = await tx.recurringTaskTemplate.findUnique({
          where: { id: templateId },
          include: {
            project: {
              select: {
                id: true,
                code: true,
                nextTaskSequence: true,
                deletedAt: true,
              },
            },
          },
        });

        if (!template || !template.isActive || template.nextRunAt > now) {
          return;
        }

        if (template.project.deletedAt) {
          await tx.recurringTaskTemplate.update({
            where: { id: template.id },
            data: {
              isActive: false,
              updatedAt: now,
            },
          });
          return;
        }

        const status = template.statusId
          ? await tx.taskStatus.findFirst({
              where: {
                tenantId: template.tenantId,
                projectId: template.projectId,
                id: template.statusId,
                deletedAt: null,
              },
              select: { id: true },
            })
          : await tx.taskStatus.findFirst({
              where: {
                tenantId: template.tenantId,
                projectId: template.projectId,
                deletedAt: null,
              },
              orderBy: [{ isDefault: 'desc' }, { position: 'asc' }],
              select: { id: true },
            });

        const nextRunAt = this.calculateNextRunAt(
          template.nextRunAt,
          template.frequency,
          template.interval,
        );

        if (!status) {
          await tx.recurringTaskTemplate.update({
            where: { id: template.id },
            data: {
              lastRunAt: now,
              nextRunAt,
              isActive: template.endsAt ? nextRunAt <= template.endsAt : true,
            },
          });
          return;
        }

        const key = `${template.project.code}-${template.project.nextTaskSequence}`;

        await tx.project.update({
          where: { id: template.projectId },
          data: {
            nextTaskSequence: {
              increment: 1,
            },
          },
        });

        const createdTask = await tx.task.create({
          data: {
            tenantId: template.tenantId,
            projectId: template.projectId,
            milestoneId: template.milestoneId,
            taskStatusId: status.id,
            recurringTemplateId: template.id,
            key,
            title: template.titleTemplate,
            description: template.description,
            assigneeId: template.defaultAssigneeId,
            estimateHours: template.estimateHours,
            priority: template.priority ?? TaskPriority.MEDIUM,
            tags: template.tags as Prisma.InputJsonValue | undefined,
            externalReferences:
              template.externalReferences as Prisma.InputJsonValue | undefined,
            createdBy: template.createdBy,
            updatedBy: template.createdBy,
          },
        });

        await tx.taskStatusTransition.create({
          data: {
            tenantId: template.tenantId,
            projectId: template.projectId,
            taskId: createdTask.id,
            fromStatusId: null,
            toStatusId: createdTask.taskStatusId,
            enteredAt: createdTask.createdAt,
            changedBy: template.createdBy,
          },
        });

        await tx.recurringTaskTemplate.update({
          where: { id: template.id },
          data: {
            lastRunAt: now,
            nextRunAt,
            isActive: template.endsAt ? nextRunAt <= template.endsAt : true,
          },
        });

        await this.auditService.log({
          tenantId: template.tenantId,
          actorId: template.createdBy ?? undefined,
          action: 'TASK_RECURRING_GENERATE',
          entityType: 'RecurringTaskTemplate',
          entityId: template.id,
          metadata: {
            generatedAt: now.toISOString(),
            projectId: template.projectId,
          },
        });
      });
    } catch (error) {
      this.logger.error(`Failed recurring template ${templateId}`, error as Error);
    }
  }

  private calculateNextRunAt(
    current: Date,
    frequency: RecurringFrequency,
    interval: number,
  ): Date {
    const next = new Date(current);
    const safeInterval = Math.max(1, interval);

    switch (frequency) {
      case RecurringFrequency.DAILY:
        next.setUTCDate(next.getUTCDate() + safeInterval);
        return next;
      case RecurringFrequency.WEEKLY:
        next.setUTCDate(next.getUTCDate() + 7 * safeInterval);
        return next;
      case RecurringFrequency.MONTHLY:
        next.setUTCMonth(next.getUTCMonth() + safeInterval);
        return next;
      default:
        next.setUTCDate(next.getUTCDate() + safeInterval);
        return next;
    }
  }
}
