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
import { PERMISSIONS } from '../../../common/constants/permission.constants';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { ListGithubUnmatchedCommitsDto } from './dto/list-github-unmatched-commits.dto';
import { MapUnmatchedCommitDto } from './dto/map-unmatched-commit.dto';
import { UpsertGithubSettingsDto } from './dto/upsert-github-settings.dto';
import { GithubIntegrationsService } from './github-integrations.service';

@ApiTags('Integrations - GitHub')
@ApiBearerAuth()
@Controller('integrations/github')
export class GithubIntegrationsController {
  constructor(private readonly githubService: GithubIntegrationsService) {}

  @Post('settings')
  @RequirePermissions(PERMISSIONS.INTEGRATIONS_GITHUB_SETTINGS_WRITE)
  @ApiOperation({ summary: 'Upsert tenant GitHub integration settings' })
  @ApiBody({ type: UpsertGithubSettingsDto })
  @ApiCreatedResponse({ description: 'GitHub settings saved' })
  upsertSettings(@CurrentUser() user: Express.User, @Body() dto: UpsertGithubSettingsDto) {
    return this.githubService.upsertSettings(user.tenantId, user.sub, dto);
  }

  @Get('settings')
  @RequirePermissions(PERMISSIONS.INTEGRATIONS_GITHUB_SETTINGS_READ)
  @ApiOperation({ summary: 'Get tenant GitHub integration settings' })
  @ApiOkResponse({ description: 'GitHub settings' })
  getSettings(@CurrentUser() user: Express.User) {
    return this.githubService.getSettings(user.tenantId);
  }

  @Get('unmatched-commits')
  @RequirePermissions(PERMISSIONS.INTEGRATIONS_GITHUB_UNMATCHED_READ)
  @ApiOperation({ summary: 'List unmatched GitHub commits' })
  @ApiOkResponse({ description: 'Unmatched commit list' })
  listUnmatched(@CurrentUser() user: Express.User, @Query() query: ListGithubUnmatchedCommitsDto) {
    return this.githubService.listUnmatchedCommits(user.tenantId, query);
  }

  @Post('unmatched-commits/:id/map')
  @RequirePermissions(PERMISSIONS.INTEGRATIONS_GITHUB_UNMATCHED_MAP)
  @ApiOperation({ summary: 'Manually map unmatched GitHub commit to task key' })
  @ApiParam({ name: 'id', example: 'cuid_unmatched_1' })
  @ApiBody({ type: MapUnmatchedCommitDto })
  @ApiOkResponse({ description: 'Commit mapped and confirmation event created' })
  mapUnmatched(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: MapUnmatchedCommitDto,
  ) {
    return this.githubService.mapUnmatchedCommit(user.tenantId, user, id, dto);
  }

  @Get('events')
  @RequirePermissions(PERMISSIONS.INTEGRATIONS_GITHUB_EVENTS_READ)
  @ApiOperation({ summary: 'List GitHub webhook events' })
  @ApiOkResponse({ description: 'GitHub webhook event list' })
  listEvents(@CurrentUser() user: Express.User, @Query() query: ListGithubUnmatchedCommitsDto) {
    return this.githubService.listWebhookEvents(user.tenantId, query);
  }
}
