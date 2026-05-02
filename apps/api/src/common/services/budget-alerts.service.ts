import { Injectable } from '@nestjs/common';
import { BudgetAlertThreshold } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../../modules/audit/audit.service';
import { ProjectCostingService } from './project-costing.service';

interface BudgetThresholdConfig {
  threshold: BudgetAlertThreshold;
  pct: number;
}

const THRESHOLDS: BudgetThresholdConfig[] = [
  { threshold: BudgetAlertThreshold.P80, pct: 80 },
  { threshold: BudgetAlertThreshold.P100, pct: 100 },
  { threshold: BudgetAlertThreshold.P120, pct: 120 },
];

@Injectable()
export class BudgetAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectCostingService: ProjectCostingService,
    private readonly auditService: AuditService,
  ) {}

  async evaluateProjectBudget(
    tenantId: string,
    projectId: string,
    actorId?: string,
  ): Promise<{ triggered: BudgetAlertThreshold[] }> {
    const costs = await this.projectCostingService.calculateProjectCostComponents(
      tenantId,
      projectId,
    );

    if (!costs.budgetAmount || costs.budgetAmount <= 0) {
      return { triggered: [] };
    }

    const utilizationPct = (costs.totalBurn / costs.budgetAmount) * 100;
    const existing = await this.prisma.budgetAlert.findMany({
      where: {
        tenantId,
        projectId,
      },
      select: {
        threshold: true,
      },
    });

    const existingSet = new Set(existing.map((item) => item.threshold));
    const triggered: BudgetAlertThreshold[] = [];

    for (const config of THRESHOLDS) {
      if (utilizationPct < config.pct || existingSet.has(config.threshold)) {
        continue;
      }

      const alert = await this.prisma.budgetAlert.create({
        data: {
          tenantId,
          projectId,
          threshold: config.threshold,
          burnAmountSnapshot: costs.totalBurn,
          budgetAmountSnapshot: costs.budgetAmount,
        },
      });

      await this.auditService.log({
        tenantId,
        actorId,
        action: 'BUDGET_ALERT_TRIGGER',
        entityType: 'BudgetAlert',
        entityId: alert.id,
        metadata: {
          threshold: config.threshold,
          utilizationPct: Number(utilizationPct.toFixed(2)),
        },
      });

      triggered.push(config.threshold);
    }

    return { triggered };
  }
}
