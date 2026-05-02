import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationDeliveryProcessor } from './notification-delivery.processor';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notification-deliveries',
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationDeliveryProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
