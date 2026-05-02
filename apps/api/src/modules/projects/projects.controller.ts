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
import { AddProjectCostsDto } from './dto/add-project-costs.dto';
import { AddProjectMembersDto } from './dto/add-project-members.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { GetProjectBurnDto } from './dto/get-project-burn.dto';
import { ListProjectsDto } from './dto/list-projects.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.PROJECTS_CREATE)
  @ApiOperation({ summary: 'Create project in current tenant' })
  @ApiBody({
    type: CreateProjectDto,
    examples: {
      default: {
        value: {
          name: 'Tenant Platform Upgrade',
          code: 'T',
          description: 'Phase 2 delivery',
          teamId: 'cuid_team_1',
          status: 'ACTIVE',
          startDate: '2026-05-01T00:00:00.000Z',
          endDate: '2026-12-31T23:59:59.000Z',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Project created' })
  createProject(@CurrentUser() user: Express.User, @Body() dto: CreateProjectDto) {
    return this.projectsService.createProject(user.tenantId, user, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.PROJECTS_READ)
  @ApiOperation({ summary: 'List projects' })
  @ApiOkResponse({ description: 'Project list with pagination' })
  listProjects(@CurrentUser() user: Express.User, @Query() query: ListProjectsDto) {
    return this.projectsService.listProjects(user.tenantId, user, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PROJECTS_READ)
  @ApiOperation({ summary: 'Get project by id' })
  @ApiParam({ name: 'id', example: 'cuid_project_1' })
  @ApiOkResponse({ description: 'Project details' })
  getProject(@CurrentUser() user: Express.User, @Param('id') id: string) {
    return this.projectsService.getProjectById(user.tenantId, user, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PROJECTS_UPDATE)
  @ApiOperation({ summary: 'Update project by id' })
  @ApiParam({ name: 'id', example: 'cuid_project_1' })
  @ApiOkResponse({ description: 'Project updated' })
  updateProject(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.updateProject(user.tenantId, user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PROJECTS_DELETE)
  @ApiOperation({ summary: 'Soft delete project by id' })
  @ApiParam({ name: 'id', example: 'cuid_project_1' })
  @ApiOkResponse({ description: 'Project deleted' })
  deleteProject(@CurrentUser() user: Express.User, @Param('id') id: string) {
    return this.projectsService.deleteProject(user.tenantId, user, id);
  }

  @Post(':id/members')
  @RequirePermissions(PERMISSIONS.PROJECTS_MEMBERS_WRITE)
  @ApiOperation({ summary: 'Add members to project' })
  @ApiParam({ name: 'id', example: 'cuid_project_1' })
  @ApiBody({ type: AddProjectMembersDto })
  @ApiOkResponse({ description: 'Project members added' })
  addMembers(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: AddProjectMembersDto,
  ) {
    return this.projectsService.addProjectMembers(user.tenantId, user, id, dto);
  }

  @Post(':id/costs')
  @RequirePermissions(PERMISSIONS.PROJECTS_COSTS_WRITE)
  @ApiOperation({ summary: 'Append project cost entries' })
  @ApiParam({ name: 'id', example: 'cuid_project_1' })
  @ApiBody({ type: AddProjectCostsDto })
  @ApiOkResponse({ description: 'Project costs appended' })
  addCosts(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: AddProjectCostsDto,
  ) {
    return this.projectsService.addProjectCosts(user.tenantId, user, id, dto);
  }

  @Get(':id/burn')
  @RequirePermissions(PERMISSIONS.PROJECTS_BURN_READ)
  @ApiOperation({
    summary: 'Get project cost burn (labor + overhead + project costs)',
  })
  @ApiParam({ name: 'id', example: 'cuid_project_1' })
  @ApiOkResponse({ description: 'Project cost burn with thresholds and daily breakdown' })
  getBurn(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Query() query: GetProjectBurnDto,
  ) {
    return this.projectsService.getProjectBurn(user.tenantId, user, id, query);
  }

  @Get(':id/cost-summary')
  @RequirePermissions(PERMISSIONS.PROJECTS_COST_SUMMARY_READ)
  @ApiOperation({ summary: 'Get project cost summary components and daily breakdown' })
  @ApiParam({ name: 'id', example: 'cuid_project_1' })
  @ApiOkResponse({ description: 'Project cost summary' })
  getCostSummary(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Query() query: GetProjectBurnDto,
  ) {
    return this.projectsService.getProjectCostSummary(user.tenantId, user, id, query);
  }
}
