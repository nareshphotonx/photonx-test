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
import { CreateTaskWorkflowDto } from './dto/create-task-workflow.dto';
import { ListTaskWorkflowsDto } from './dto/list-task-workflows.dto';
import { TaskWorkflowsService } from './task-workflows.service';

@ApiTags('Task Workflows')
@ApiBearerAuth()
@Controller('task-workflows')
export class TaskWorkflowsController {
  constructor(private readonly service: TaskWorkflowsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.TASK_WORKFLOWS_CREATE)
  @ApiOperation({ summary: 'Create task workflow for project' })
  @ApiBody({ type: CreateTaskWorkflowDto })
  @ApiCreatedResponse({ description: 'Workflow created' })
  createWorkflow(@CurrentUser() user: Express.User, @Body() dto: CreateTaskWorkflowDto) {
    return this.service.createWorkflow(user.tenantId, user, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.TASK_WORKFLOWS_READ)
  @ApiOperation({ summary: 'List task workflows for project' })
  @ApiOkResponse({ description: 'Workflow list' })
  listWorkflows(
    @CurrentUser() user: Express.User,
    @Query() query: ListTaskWorkflowsDto,
  ) {
    return this.service.listWorkflows(user.tenantId, user, query);
  }
}
