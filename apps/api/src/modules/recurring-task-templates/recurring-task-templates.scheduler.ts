import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class RecurringTaskTemplatesScheduler implements OnModuleInit {
  constructor(
    @InjectQueue('recurring-task-templates')
    private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'recurring-task-template-tick',
      {
        every: 60_000,
      },
      {
        name: 'template-tick',
        data: {},
        opts: {
          removeOnComplete: true,
          removeOnFail: 100,
        },
      },
    );
  }
}
