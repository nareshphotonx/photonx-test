import { Module } from '@nestjs/common';
import { ProjectCostingService } from '../../common/services/project-costing.service';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ProjectDashboardService } from './project-dashboard.service';
import { UserPerformanceService } from './user-performance.service';

@Module({
  controllers: [DashboardController],
  providers: [
    DashboardService,
    UserPerformanceService,
    ProjectDashboardService,
    TenantRbacScopeService,
    ProjectCostingService,
  ],
})
export class DashboardModule {}
