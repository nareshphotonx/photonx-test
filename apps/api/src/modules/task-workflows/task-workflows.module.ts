import { Module } from '@nestjs/common';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { TaskWorkflowsController } from './task-workflows.controller';
import { TaskWorkflowsService } from './task-workflows.service';

@Module({
  controllers: [TaskWorkflowsController],
  providers: [TaskWorkflowsService, TenantRbacScopeService],
  exports: [TaskWorkflowsService],
})
export class TaskWorkflowsModule {}
