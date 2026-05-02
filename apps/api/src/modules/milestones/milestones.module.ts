import { Module } from '@nestjs/common';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { MilestonesController } from './milestones.controller';
import { MilestonesService } from './milestones.service';

@Module({
  controllers: [MilestonesController],
  providers: [MilestonesService, TenantRbacScopeService],
  exports: [MilestonesService],
})
export class MilestonesModule {}
