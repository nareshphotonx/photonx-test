import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permission.constants';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { UpsertSlackSettingsDto } from './dto/upsert-slack-settings.dto';
import { SlackIntegrationsService } from './slack-integrations.service';

@ApiTags('Integrations - Slack')
@ApiBearerAuth()
@Controller('integrations/slack')
export class SlackIntegrationsController {
  constructor(private readonly slackService: SlackIntegrationsService) {}

  @Post('settings')
  @RequirePermissions(PERMISSIONS.INTEGRATIONS_SLACK_SETTINGS_WRITE)
  @ApiOperation({ summary: 'Upsert tenant Slack integration settings' })
  @ApiBody({ type: UpsertSlackSettingsDto })
  @ApiCreatedResponse({ description: 'Slack settings saved' })
  upsertSettings(@CurrentUser() user: Express.User, @Body() dto: UpsertSlackSettingsDto) {
    return this.slackService.upsertSettings(user.tenantId, user.sub, dto);
  }
}
