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
import { UpsertEmailSettingsDto } from './dto/upsert-email-settings.dto';
import { EmailIntegrationsService } from './email-integrations.service';

@ApiTags('Integrations - Email')
@ApiBearerAuth()
@Controller('integrations/email')
export class EmailIntegrationsController {
  constructor(private readonly emailService: EmailIntegrationsService) {}

  @Post('settings')
  @RequirePermissions(PERMISSIONS.INTEGRATIONS_EMAIL_SETTINGS_WRITE)
  @ApiOperation({ summary: 'Upsert tenant email SMTP integration settings' })
  @ApiBody({ type: UpsertEmailSettingsDto })
  @ApiCreatedResponse({ description: 'Email settings saved' })
  upsertSettings(@CurrentUser() user: Express.User, @Body() dto: UpsertEmailSettingsDto) {
    return this.emailService.upsertSettings(user.tenantId, user.sub, dto);
  }
}
