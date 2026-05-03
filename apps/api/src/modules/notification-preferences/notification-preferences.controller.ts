import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationPreferencesService } from './notification-preferences.service';

@ApiTags('Notification Preferences')
@ApiBearerAuth()
@Controller('notification-preferences')
export class NotificationPreferencesController {
  constructor(
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @Get('me')
  @RequirePermissions(PERMISSIONS.NOTIFICATION_SELF_READ)
  @ApiOperation({ summary: 'Get current user notification preferences' })
  @ApiOkResponse({ description: 'Notification preferences' })
  getMine(@CurrentUser() user: Express.User) {
    return this.notificationPreferencesService.getMine(user.tenantId, user.sub);
  }

  @Patch('me')
  @RequirePermissions(PERMISSIONS.NOTIFICATION_SELF_UPDATE)
  @ApiOperation({ summary: 'Update current user notification preferences' })
  @ApiBody({ type: UpdateNotificationPreferencesDto })
  @ApiOkResponse({ description: 'Notification preferences updated' })
  updateMine(
    @CurrentUser() user: Express.User,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationPreferencesService.updateMine(user.tenantId, user.sub, dto);
  }
}
