import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { RecurringTaskTemplatesProcessor } from './recurring-task-templates.processor';
import { RecurringTaskTemplatesScheduler } from './recurring-task-templates.scheduler';
import { RecurringTaskTemplatesService } from './recurring-task-templates.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'recurring-task-templates',
    }),
  ],
  providers: [
    RecurringTaskTemplatesService,
    RecurringTaskTemplatesProcessor,
    RecurringTaskTemplatesScheduler,
  ],
  exports: [RecurringTaskTemplatesService],
})
export class RecurringTaskTemplatesModule {}
