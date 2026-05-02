import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TaskDependencyService } from '../../common/services/task-dependency.service';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { TasksController } from './tasks.controller';
import { TasksNotificationProcessor } from './tasks-notification.processor';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notification-events',
    }),
  ],
  controllers: [TasksController],
  providers: [
    TasksService,
    TenantRbacScopeService,
    TaskDependencyService,
    TasksNotificationProcessor,
  ],
  exports: [TasksService],
})
export class TasksModule {}
