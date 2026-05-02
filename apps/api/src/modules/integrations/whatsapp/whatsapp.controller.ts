import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permission.constants';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { ListWhatsappSessionsDto } from './dto/list-whatsapp-sessions.dto';
import { WhatsappSendTemplateDto } from './dto/whatsapp-send-template.dto';
import { WhatsappTestCommandDto } from './dto/whatsapp-test-command.dto';
import { WhatsappService } from './whatsapp.service';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Public()
  @Post('test-command')
  @ApiHeader({ name: 'x-whatsapp-test-secret', required: true })
  @ApiOperation({ summary: 'Parse and dry-run execute a WhatsApp command for testing' })
  @ApiBody({ type: WhatsappTestCommandDto })
  @ApiOkResponse({ description: 'Parsed command and simulated output' })
  testCommand(
    @Body() dto: WhatsappTestCommandDto,
    @Headers('x-whatsapp-test-secret') secret: string | undefined,
  ) {
    return this.whatsappService.testCommand(dto, secret);
  }

  @ApiBearerAuth()
  @Post('send-template')
  @RequirePermissions(PERMISSIONS.INTEGRATIONS_WHATSAPP_TEMPLATE_SEND)
  @ApiOperation({ summary: 'Send utility template to user via WhatsApp' })
  @ApiBody({ type: WhatsappSendTemplateDto })
  @ApiCreatedResponse({ description: 'Template sent' })
  sendTemplate(@CurrentUser() user: Express.User, @Body() dto: WhatsappSendTemplateDto) {
    return this.whatsappService.sendTemplate(user.tenantId, user.sub, dto);
  }

  @ApiBearerAuth()
  @Get('sessions')
  @RequirePermissions(PERMISSIONS.INTEGRATIONS_WHATSAPP_SESSIONS_READ)
  @ApiOperation({ summary: 'List WhatsApp sessions' })
  @ApiOkResponse({ description: 'WhatsApp session list' })
  listSessions(@CurrentUser() user: Express.User, @Query() query: ListWhatsappSessionsDto) {
    return this.whatsappService.listSessions(user.tenantId, query);
  }

  @ApiBearerAuth()
  @Get('messages')
  @RequirePermissions(PERMISSIONS.INTEGRATIONS_WHATSAPP_MESSAGES_READ)
  @ApiOperation({ summary: 'List WhatsApp messages' })
  @ApiOkResponse({ description: 'WhatsApp message list' })
  listMessages(@CurrentUser() user: Express.User, @Query() query: ListWhatsappSessionsDto) {
    return this.whatsappService.listMessages(user.tenantId, query);
  }
}
