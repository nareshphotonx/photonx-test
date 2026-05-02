import { Module } from '@nestjs/common';
import { BudgetAlertsService } from '../../common/services/budget-alerts.service';
import { ProjectCostingService } from '../../common/services/project-costing.service';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { TimeEntriesController } from './time-entries.controller';
import { TimeEntriesService } from './time-entries.service';

@Module({
  controllers: [TimeEntriesController],
  providers: [
    TimeEntriesService,
    TenantRbacScopeService,
    ProjectCostingService,
    BudgetAlertsService,
  ],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}
