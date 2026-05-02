import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { LeaveModule } from '../leave/leave.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksModule } from '../tasks/tasks.module';
import { TimeEntriesModule } from '../time-entries/time-entries.module';
import { WfhModule } from '../wfh/wfh.module';
import { EmailIntegrationsController } from './email/email-integrations.controller';
import { EmailIntegrationsService } from './email/email-integrations.service';
import { GithubSignatureService } from './github/github-signature.service';
import { GithubIntegrationsController } from './github/github-integrations.controller';
import { GithubIntegrationsService } from './github/github-integrations.service';
import { IntegrationSettingsService } from './integration-settings.service';
import { SlackIntegrationsController } from './slack/slack-integrations.controller';
import { SlackIntegrationsService } from './slack/slack-integrations.service';
import { WhatsappCommandParserService } from './whatsapp/whatsapp-command-parser.service';
import { WhatsappController } from './whatsapp/whatsapp.controller';
import { WhatsappService } from './whatsapp/whatsapp.service';

@Module({
  imports: [
    NotificationsModule,
    AttendanceModule,
    LeaveModule,
    WfhModule,
    ExpensesModule,
    TasksModule,
    TimeEntriesModule,
    ApprovalsModule,
  ],
  controllers: [
    GithubIntegrationsController,
    SlackIntegrationsController,
    EmailIntegrationsController,
    WhatsappController,
  ],
  providers: [
    IntegrationSettingsService,
    GithubSignatureService,
    GithubIntegrationsService,
    SlackIntegrationsService,
    EmailIntegrationsService,
    WhatsappCommandParserService,
    WhatsappService,
  ],
  exports: [GithubIntegrationsService, WhatsappService, IntegrationSettingsService],
})
export class IntegrationsModule {}
