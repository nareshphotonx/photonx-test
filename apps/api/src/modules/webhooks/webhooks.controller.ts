import { Body, Controller, Get, Headers, Post, Query, Req } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { GithubIntegrationsService } from '../integrations/github/github-integrations.service';
import { WhatsappService } from '../integrations/whatsapp/whatsapp.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly githubService: GithubIntegrationsService,
  ) {}

  @Public()
  @Get('whatsapp')
  @SkipThrottle({ default: true })
  @Throttle({
    webhooks: {
      limit: Number(process.env.THROTTLE_WEBHOOK_LIMIT ?? '300'),
      ttl: Number(process.env.THROTTLE_WEBHOOK_TTL_MS ?? '60000'),
    },
  })
  @ApiOperation({ summary: 'Meta WhatsApp webhook verification endpoint' })
  @ApiQuery({ name: 'hub.mode', required: false })
  @ApiQuery({ name: 'hub.verify_token', required: false })
  @ApiQuery({ name: 'hub.challenge', required: false })
  @ApiOkResponse({ description: 'Returns challenge string on successful verification' })
  verifyWhatsApp(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
  ) {
    return this.whatsappService.verifyWebhook(mode, token, challenge);
  }

  @Public()
  @Post('whatsapp')
  @SkipThrottle({ default: true })
  @Throttle({
    webhooks: {
      limit: Number(process.env.THROTTLE_WEBHOOK_LIMIT ?? '300'),
      ttl: Number(process.env.THROTTLE_WEBHOOK_TTL_MS ?? '60000'),
    },
  })
  @ApiOperation({ summary: 'Inbound WhatsApp webhook handler' })
  @ApiBody({ type: Object })
  @ApiOkResponse({ description: 'Webhook processed' })
  handleWhatsApp(@Body() payload: unknown) {
    return this.whatsappService.handleWebhook(payload);
  }

  @Public()
  @Post('github')
  @SkipThrottle({ default: true })
  @Throttle({
    webhooks: {
      limit: Number(process.env.THROTTLE_WEBHOOK_LIMIT ?? '300'),
      ttl: Number(process.env.THROTTLE_WEBHOOK_TTL_MS ?? '60000'),
    },
  })
  @ApiOperation({ summary: 'Inbound GitHub webhook handler' })
  @ApiBody({ type: Object })
  @ApiOkResponse({ description: 'Webhook processed or deduplicated' })
  handleGithub(
    @Req() request: Request,
    @Body() payload: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const rawBody = Buffer.isBuffer(request.rawBody)
      ? request.rawBody
      : Buffer.from(JSON.stringify(payload ?? {}));

    return this.githubService.handleWebhook(headers, rawBody, payload);
  }
}
