import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { RecurringTaskTemplatesService } from './recurring-task-templates.service';

@Injectable()
@Processor('recurring-task-templates')
export class RecurringTaskTemplatesProcessor extends WorkerHost {
  constructor(private readonly service: RecurringTaskTemplatesService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'template-tick') {
      return;
    }

    await this.service.processDueTemplates(new Date());
  }
}
