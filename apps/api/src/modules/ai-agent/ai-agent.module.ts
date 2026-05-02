import { Module } from '@nestjs/common';
import { TenantRbacScopeService } from '../../common/services/tenant-rbac-scope.service';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { AuditModule } from '../audit/audit.module';
import { DocumentsModule } from '../documents/documents.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { LeaveModule } from '../leave/leave.module';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';
import { TimeEntriesModule } from '../time-entries/time-entries.module';
import { WfhModule } from '../wfh/wfh.module';
import { AiAgentController } from './ai-agent.controller';
import { AiAgentService } from './ai-agent.service';
import { AiCacheService } from './ai-cache.service';
import { AiPromptDefenseService } from './ai-prompt-defense.service';
import { AiToolExecutorService } from './ai-tool-executor.service';
import { AiToolRegistryService } from './ai-tool-registry.service';
import { OpenAiProviderService } from './providers/openai-provider.service';

@Module({
  imports: [
    AuditModule,
    LeaveModule,
    WfhModule,
    TasksModule,
    TimeEntriesModule,
    ProjectsModule,
    ApprovalsModule,
    ExpensesModule,
    AttendanceModule,
    DocumentsModule,
  ],
  controllers: [AiAgentController],
  providers: [
    AiAgentService,
    AiToolRegistryService,
    AiToolExecutorService,
    TenantRbacScopeService,
    AiPromptDefenseService,
    AiCacheService,
    OpenAiProviderService,
  ],
  exports: [AiCacheService],
})
export class AiAgentModule {}
