import { Module } from '@nestjs/common';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { TaskStatusesController } from './task-statuses.controller';
import { TaskStatusesService } from './task-statuses.service';

@Module({
  controllers: [TaskStatusesController],
  providers: [TaskStatusesService, TenantRbacScopeService],
  exports: [TaskStatusesService],
})
export class TaskStatusesModule {}
