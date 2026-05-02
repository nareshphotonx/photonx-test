import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_SEND)
  @ApiOperation({ summary: 'Send notification event to users with channel fan-out' })
  @ApiBody({ type: SendNotificationDto })
  @ApiCreatedResponse({ description: 'Notification event created or deduplicated' })
  send(@CurrentUser() user: Express.User, @Body() dto: SendNotificationDto) {
    return this.notificationsService.send(user.tenantId, user, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_READ)
  @ApiOperation({ summary: 'List current user notifications' })
  @ApiOkResponse({ description: 'Notification inbox list' })
  list(@CurrentUser() user: Express.User, @Query() query: ListNotificationsDto) {
    return this.notificationsService.listMine(user.tenantId, user.sub, query);
  }

  @Post(':id/read')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_MARK_READ)
  @ApiOperation({ summary: 'Mark current user notification as read' })
  @ApiParam({ name: 'id', example: 'cuid_notification_event_1' })
  @ApiOkResponse({ description: 'Notification marked as read' })
  markRead(@CurrentUser() user: Express.User, @Param('id') id: string) {
    return this.notificationsService.markRead(user.tenantId, user.sub, id);
  }
}
