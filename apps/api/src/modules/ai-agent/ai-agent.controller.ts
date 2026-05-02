import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AiAgentService } from './ai-agent.service';
import { AiChatDto } from './dto/ai-chat.dto';
import { ListAiMessagesDto } from './dto/list-ai-messages.dto';

@ApiTags('AI Agent')
@ApiBearerAuth()
@Controller('ai')
export class AiAgentController {
  constructor(private readonly aiAgentService: AiAgentService) {}

  @Post('chat')
  @RequirePermissions(PERMISSIONS.AI_CHAT)
  @ApiOperation({ summary: 'Chat with tenant-safe AI agent' })
  @ApiBody({
    type: AiChatDto,
    examples: {
      tool: {
        value: {
          prompt: 'Show my leave balance this year',
        },
      },
      rag: {
        value: {
          prompt: 'What does policy say about optional holidays?',
          conversationId: 'cuid_ai_conversation_1',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'AI response with provenance fields' })
  chat(@CurrentUser() user: Express.User, @Body() dto: AiChatDto) {
    return this.aiAgentService.chat(user.tenantId, user, dto);
  }

  @Get('tools')
  @RequirePermissions(PERMISSIONS.AI_TOOLS_READ)
  @ApiOperation({ summary: 'List registered typed AI tools' })
  @ApiOkResponse({ description: 'Tool metadata list' })
  listTools() {
    return this.aiAgentService.listTools();
  }

  @Get('messages')
  @RequirePermissions(PERMISSIONS.AI_MESSAGES_READ)
  @ApiOperation({ summary: 'List AI messages (own-only for USER, scoped override for admin)' })
  @ApiOkResponse({ description: 'AI message list' })
  listMessages(@CurrentUser() user: Express.User, @Query() query: ListAiMessagesDto) {
    return this.aiAgentService.listMessages(user.tenantId, user, query);
  }
}
