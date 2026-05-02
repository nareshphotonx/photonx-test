import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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
import { AddTeamMembersDto } from './dto/add-team-members.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { ListTeamsDto } from './dto/list-teams.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsService } from './teams.service';

@ApiTags('Teams')
@ApiBearerAuth()
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.TEAMS_CREATE)
  @ApiOperation({ summary: 'Create team in tenant' })
  @ApiCreatedResponse({ description: 'Team created' })
  createTeam(@CurrentUser() user: Express.User, @Body() dto: CreateTeamDto) {
    return this.teamsService.createTeam(user.tenantId, user.sub, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.TEAMS_READ)
  @ApiOperation({ summary: 'List teams in tenant' })
  @ApiOkResponse({ description: 'Team list' })
  listTeams(@CurrentUser() user: Express.User, @Query() query: ListTeamsDto) {
    return this.teamsService.listTeams(user.tenantId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TEAMS_READ)
  @ApiOperation({ summary: 'Get team by id' })
  @ApiParam({ name: 'id', example: 'ckx_team_1' })
  @ApiOkResponse({ description: 'Team details' })
  getTeamById(@CurrentUser() user: Express.User, @Param('id') id: string) {
    return this.teamsService.getTeamById(user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TEAMS_UPDATE)
  @ApiOperation({ summary: 'Update team by id' })
  @ApiParam({ name: 'id', example: 'ckx_team_1' })
  @ApiOkResponse({ description: 'Team updated' })
  updateTeam(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamsService.updateTeam(user.tenantId, user.sub, id, dto);
  }

  @Post(':id/members')
  @RequirePermissions(PERMISSIONS.TEAMS_MEMBERS_WRITE)
  @ApiOperation({ summary: 'Add members to team' })
  @ApiParam({ name: 'id', example: 'ckx_team_1' })
  @ApiBody({
    type: Object,
    examples: {
      default: {
        value: {
          userIds: ['ckx_user_1', 'ckx_user_2'],
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Members added' })
  addMembers(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: AddTeamMembersDto,
  ) {
    return this.teamsService.addMembers(user.tenantId, user.sub, id, dto);
  }

  @Delete(':id/members/:userId')
  @RequirePermissions(PERMISSIONS.TEAMS_MEMBERS_WRITE)
  @ApiOperation({ summary: 'Remove member from team' })
  @ApiParam({ name: 'id', example: 'ckx_team_1' })
  @ApiParam({ name: 'userId', example: 'ckx_user_1' })
  @ApiOkResponse({ description: 'Member removed' })
  removeMember(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.teamsService.removeMember(user.tenantId, user.sub, id, userId);
  }
}
