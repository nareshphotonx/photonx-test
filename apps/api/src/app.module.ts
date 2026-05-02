import {
  MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppLogger } from './common/logger/app.logger';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { PrismaModule } from './common/prisma/prisma.module';
import { QueueModule } from './common/queue/queue.module';
import { SecurityModule } from './common/security/security.module';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { HealthModule } from './modules/health/health.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { NotificationPreferencesModule } from './modules/notification-preferences/notification-preferences.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OfficePolicyModule } from './modules/office-policy/office-policy.module';
import { HolidaysModule } from './modules/holidays/holidays.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { LeaveModule } from './modules/leave/leave.module';
import { MilestonesModule } from './modules/milestones/milestones.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RecurringTaskTemplatesModule } from './modules/recurring-task-templates/recurring-task-templates.module';
import { RolesModule } from './modules/roles/roles.module';
import { TaskStatusesModule } from './modules/task-statuses/task-statuses.module';
import { TaskWorkflowsModule } from './modules/task-workflows/task-workflows.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TimeEntriesModule } from './modules/time-entries/time-entries.module';
import { TenantContextGuard } from './modules/tenant/guards/tenant-context.guard';
import { TenantContextMiddleware } from './modules/tenant/middleware/tenant-context.middleware';
import { TenantModule } from './modules/tenant/tenant.module';
import { TeamsModule } from './modules/teams/teams.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { WfhModule } from './modules/wfh/wfh.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/api/.env', '.env'],
    }),
    SecurityModule,
    PrismaModule,
    QueueModule,
    AuthModule,
    TenantModule,
    AuditModule,
    HealthModule,
    TenantsModule,
    UsersModule,
    TeamsModule,
    RolesModule,
    ApprovalsModule,
    AttendanceModule,
    LeaveModule,
    WfhModule,
    HolidaysModule,
    ExpensesModule,
    OfficePolicyModule,
    NotificationPreferencesModule,
    NotificationsModule,
    ProjectsModule,
    MilestonesModule,
    TaskStatusesModule,
    TaskWorkflowsModule,
    TasksModule,
    TimeEntriesModule,
    AttachmentsModule,
    RecurringTaskTemplatesModule,
    IntegrationsModule,
    WebhooksModule,
  ],
  providers: [
    AppLogger,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantContextGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware, TenantContextMiddleware)
      .forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}
