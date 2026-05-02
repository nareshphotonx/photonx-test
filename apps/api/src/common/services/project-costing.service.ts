import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ProjectCostComponents {
  projectId: string;
  laborCost: number;
  overheadPercent: number;
  overheadCost: number;
  projectCosts: number;
  totalBurn: number;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  utilizationPct: number | null;
}

@Injectable()
export class ProjectCostingService {
  constructor(private readonly prisma: PrismaService) {}

  private readSnapshotNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  async calculateProjectCostComponents(
    tenantId: string,
    projectId: string,
    range?: {
      from?: Date;
      to?: Date;
    },
  ): Promise<ProjectCostComponents> {
    const project = await this.prisma.project.findFirst({
      where: {
        tenantId,
        id: projectId,
        deletedAt: null,
      },
      select: {
        id: true,
        overheadPercent: true,
        budgetAmount: true,
        budgetCurrency: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const [timeEntries, projectCosts] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: {
          tenantId,
          projectId,
          ...(range?.from || range?.to
            ? {
                entryDate: {
                  gte: range.from,
                  lte: range.to,
                },
              }
            : {}),
        },
        select: {
          costSnapshot: true,
        },
      }),
      this.prisma.projectCost.findMany({
        where: {
          tenantId,
          projectId,
          ...(range?.from || range?.to
            ? {
                costDate: {
                  gte: range.from,
                  lte: range.to,
                },
              }
            : {}),
        },
        select: {
          amount: true,
        },
      }),
    ]);

    const { laborCost, overheadCost } = timeEntries.reduce(
      (acc, entry) => {
        const snapshot = entry.costSnapshot as
          | {
              laborCost?: unknown;
              overheadCost?: unknown;
            }
          | null;

        acc.laborCost += this.readSnapshotNumber(snapshot?.laborCost);
        acc.overheadCost += this.readSnapshotNumber(snapshot?.overheadCost);

        return acc;
      },
      { laborCost: 0, overheadCost: 0 },
    );

    const projectCostsTotal = projectCosts.reduce(
      (acc, row) => acc + Number(row.amount),
      0,
    );

    const effectiveOverheadPercent =
      laborCost > 0 ? (overheadCost / laborCost) * 100 : Number(project.overheadPercent ?? 0);
    const totalBurn = laborCost + overheadCost + projectCostsTotal;

    const budgetAmount =
      project.budgetAmount !== null ? Number(project.budgetAmount) : null;

    const utilizationPct =
      budgetAmount && budgetAmount > 0
        ? Number(((totalBurn / budgetAmount) * 100).toFixed(2))
        : null;

    return {
      projectId: project.id,
      laborCost: Number(laborCost.toFixed(2)),
      overheadPercent: Number(effectiveOverheadPercent.toFixed(2)),
      overheadCost: Number(overheadCost.toFixed(2)),
      projectCosts: Number(projectCostsTotal.toFixed(2)),
      totalBurn: Number(totalBurn.toFixed(2)),
      budgetAmount,
      budgetCurrency: project.budgetCurrency,
      utilizationPct,
    };
  }

  async getDailyCostBreakdown(
    tenantId: string,
    projectId: string,
    range?: {
      from?: Date;
      to?: Date;
    },
  ): Promise<Array<{
    date: string;
    laborCost: number;
    overheadCost: number;
    projectCosts: number;
    totalCost: number;
  }>> {
    const [project, timeEntries, projectCosts] = await Promise.all([
      this.prisma.project.findFirst({
        where: {
          tenantId,
          id: projectId,
          deletedAt: null,
        },
        select: {
          overheadPercent: true,
        },
      }),
      this.prisma.timeEntry.findMany({
        where: {
          tenantId,
          projectId,
          ...(range?.from || range?.to
            ? {
                entryDate: {
                  gte: range.from,
                  lte: range.to,
                },
              }
            : {}),
        },
        select: {
          entryDate: true,
          costSnapshot: true,
        },
      }),
      this.prisma.projectCost.findMany({
        where: {
          tenantId,
          projectId,
          ...(range?.from || range?.to
            ? {
                costDate: {
                  gte: range.from,
                  lte: range.to,
                },
              }
            : {}),
        },
        select: {
          costDate: true,
          amount: true,
        },
      }),
    ]);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const byDate = new Map<
      string,
      { laborCost: number; overheadCost: number; projectCosts: number }
    >();

    for (const entry of timeEntries) {
      const key = entry.entryDate.toISOString().slice(0, 10);
      const snapshot = entry.costSnapshot as
        | {
            laborCost?: unknown;
            overheadCost?: unknown;
          }
        | null;
      const labor = this.readSnapshotNumber(snapshot?.laborCost);
      const overhead = this.readSnapshotNumber(snapshot?.overheadCost);

      const current = byDate.get(key) ?? {
        laborCost: 0,
        overheadCost: 0,
        projectCosts: 0,
      };
      current.laborCost += labor;
      current.overheadCost += overhead;
      byDate.set(key, current);
    }

    for (const row of projectCosts) {
      const key = row.costDate.toISOString().slice(0, 10);
      const current = byDate.get(key) ?? {
        laborCost: 0,
        overheadCost: 0,
        projectCosts: 0,
      };
      current.projectCosts += Number(row.amount);
      byDate.set(key, current);
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => {
        const totalCost = value.laborCost + value.overheadCost + value.projectCosts;

        return {
          date,
          laborCost: Number(value.laborCost.toFixed(2)),
          overheadCost: Number(value.overheadCost.toFixed(2)),
          projectCosts: Number(value.projectCosts.toFixed(2)),
          totalCost: Number(totalCost.toFixed(2)),
        };
      });
  }
}
