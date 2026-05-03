import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { MilestonesService } from './milestones.service';

@ApiTags('Milestones')
@ApiBearerAuth()
@Controller()
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Post('milestones')
  @RequirePermissions(PERMISSIONS.MILESTONES_CREATE)
  @ApiOperation({ summary: 'Create milestone' })
  @ApiBody({
    type: CreateMilestoneDto,
    examples: {
      default: {
        value: {
          projectId: 'cuid_project_1',
          name: 'Identity Hardening Rollout',
          description: 'Finish RBAC + workflow policies',
          status: 'PLANNED',
          dueDate: '2026-06-15T00:00:00.000Z',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Milestone created' })
  createMilestone(@CurrentUser() user: Express.User, @Body() dto: CreateMilestoneDto) {
    return this.milestonesService.createMilestone(user.tenantId, user, dto);
  }

  @Get('projects/:projectId/milestones')
  @RequirePermissions(PERMISSIONS.MILESTONES_READ)
  @ApiOperation({ summary: 'List milestones for project' })
  @ApiParam({ name: 'projectId', example: 'cuid_project_1' })
  @ApiOkResponse({ description: 'Milestone list' })
  listProjectMilestones(
    @CurrentUser() user: Express.User,
    @Param('projectId') projectId: string,
  ) {
    return this.milestonesService.listProjectMilestones(
      user.tenantId,
      user,
      projectId,
    );
  }

  @Get('milestones/:id')
  @RequirePermissions(PERMISSIONS.MILESTONES_READ)
  @ApiOperation({ summary: 'Get milestone by id' })
  @ApiParam({ name: 'id', example: 'cuid_milestone_1' })
  @ApiOkResponse({ description: 'Milestone details' })
  getMilestone(@CurrentUser() user: Express.User, @Param('id') id: string) {
    return this.milestonesService.getMilestoneById(user.tenantId, user, id);
  }

  @Patch('milestones/:id')
  @RequirePermissions(PERMISSIONS.MILESTONES_UPDATE)
  @ApiOperation({ summary: 'Update milestone by id' })
  @ApiParam({ name: 'id', example: 'cuid_milestone_1' })
  @ApiBody({ type: UpdateMilestoneDto })
  @ApiOkResponse({ description: 'Milestone updated' })
  updateMilestone(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.milestonesService.updateMilestone(user.tenantId, user, id, dto);
  }

  @Delete('milestones/:id')
  @RequirePermissions(PERMISSIONS.MILESTONES_DELETE)
  @ApiOperation({ summary: 'Delete milestone by id' })
  @ApiParam({ name: 'id', example: 'cuid_milestone_1' })
  @ApiOkResponse({ description: 'Milestone deleted' })
  deleteMilestone(@CurrentUser() user: Express.User, @Param('id') id: string) {
    return this.milestonesService.deleteMilestone(user.tenantId, user, id);
  }
}
