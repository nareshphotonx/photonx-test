import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService } from './notifications.service';

interface DeliveryJob {
  deliveryId: string;
}

@Injectable()
@Processor('notification-deliveries')
export class NotificationDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationDeliveryProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<DeliveryJob>): Promise<void> {
    if (job.name !== 'notification-delivery') {
      return;
    }

    try {
      await this.notificationsService.processDelivery(job.data.deliveryId);
    } catch (error) {
      this.logger.error('Failed to process notification delivery', error as Error);
      throw error;
    }
  }
}
