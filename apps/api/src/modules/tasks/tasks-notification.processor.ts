import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { NotificationEventStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';

interface TaskCommentMentionJob {
  eventId: string;
}

@Injectable()
@Processor('notification-events')
export class TasksNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(TasksNotificationProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<TaskCommentMentionJob>): Promise<void> {
    if (job.name !== 'task-comment-mention') {
      return;
    }

    const event = await this.prisma.notificationEvent.findUnique({
      where: { id: job.data.eventId },
      select: {
        id: true,
        attempts: true,
      },
    });

    if (!event) {
      return;
    }

    try {
      await this.prisma.notificationEvent.update({
        where: { id: event.id },
        data: {
          status: NotificationEventStatus.SENT,
          processedAt: new Date(),
          attempts: {
            increment: 1,
          },
        },
      });
    } catch (error) {
      this.logger.error('Failed to process notification event', error as Error);
      await this.prisma.notificationEvent.update({
        where: { id: event.id },
        data: {
          status: NotificationEventStatus.FAILED,
          attempts: {
            increment: 1,
          },
        },
      });
      throw error;
    }
  }
}
