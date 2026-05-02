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
import { BulkTaskOperationsDto } from './dto/bulk-task-operations.dto';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { CreateTaskDependencyDto } from './dto/create-task-dependency.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { GetTaskKanbanDto } from './dto/get-task-kanban.dto';
import { ListTaskCommentsDto } from './dto/list-task-comments.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.TASKS_CREATE)
  @ApiOperation({ summary: 'Create task or subtask' })
  @ApiBody({ type: CreateTaskDto })
  @ApiCreatedResponse({ description: 'Task created' })
  createTask(@CurrentUser() user: Express.User, @Body() dto: CreateTaskDto) {
    return this.tasksService.createTask(user.tenantId, user, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.TASKS_READ)
  @ApiOperation({ summary: 'List tasks' })
  @ApiOkResponse({ description: 'Task list with pagination' })
  listTasks(@CurrentUser() user: Express.User, @Query() query: ListTasksDto) {
    return this.tasksService.listTasks(user.tenantId, user, query);
  }

  @Get('kanban')
  @RequirePermissions(PERMISSIONS.TASKS_KANBAN_READ)
  @ApiOperation({ summary: 'Get kanban board grouped by statuses' })
  @ApiOkResponse({ description: 'Kanban columns with tasks' })
  getKanban(@CurrentUser() user: Express.User, @Query() query: GetTaskKanbanDto) {
    return this.tasksService.getKanban(user.tenantId, user, query);
  }

  @Post('bulk')
  @RequirePermissions(PERMISSIONS.TASKS_BULK_UPDATE)
  @ApiOperation({ summary: 'Bulk update tasks (assignee/status/due-date shift)' })
  @ApiBody({ type: BulkTaskOperationsDto })
  @ApiOkResponse({ description: 'Bulk update result' })
  bulkUpdate(@CurrentUser() user: Express.User, @Body() dto: BulkTaskOperationsDto) {
    return this.tasksService.bulkOperate(user.tenantId, user, dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TASKS_READ)
  @ApiOperation({ summary: 'Get task by id' })
  @ApiParam({ name: 'id', example: 'cuid_task_1' })
  @ApiOkResponse({ description: 'Task details' })
  getTask(@CurrentUser() user: Express.User, @Param('id') id: string) {
    return this.tasksService.getTaskById(user.tenantId, user, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TASKS_UPDATE)
  @ApiOperation({ summary: 'Update task by id' })
  @ApiParam({ name: 'id', example: 'cuid_task_1' })
  @ApiOkResponse({ description: 'Task updated' })
  updateTask(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.updateTask(user.tenantId, user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.TASKS_DELETE)
  @ApiOperation({ summary: 'Delete task by id (soft delete)' })
  @ApiParam({ name: 'id', example: 'cuid_task_1' })
  @ApiOkResponse({ description: 'Task deleted' })
  deleteTask(@CurrentUser() user: Express.User, @Param('id') id: string) {
    return this.tasksService.deleteTask(user.tenantId, user, id);
  }

  @Post(':id/status')
  @RequirePermissions(PERMISSIONS.TASKS_STATUS_UPDATE)
  @ApiOperation({ summary: 'Change task status with workflow enforcement' })
  @ApiParam({ name: 'id', example: 'cuid_task_1' })
  @ApiBody({
    type: ChangeTaskStatusDto,
    examples: {
      done: {
        value: {
          statusId: 'cuid_status_done',
          locationLatitude: 12.9701,
          locationLongitude: 77.5937,
          selfieAttachmentId: 'cuid_attachment_1',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Task status changed' })
  changeStatus(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: ChangeTaskStatusDto,
  ) {
    return this.tasksService.changeStatus(user.tenantId, user, id, dto);
  }

  @Post(':id/dependencies')
  @RequirePermissions(PERMISSIONS.TASKS_DEPENDENCIES_WRITE)
  @ApiOperation({ summary: 'Create task dependency (FINISH_TO_START)' })
  @ApiParam({ name: 'id', example: 'cuid_task_1' })
  @ApiBody({ type: CreateTaskDependencyDto })
  @ApiCreatedResponse({ description: 'Dependency created' })
  createDependency(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: CreateTaskDependencyDto,
  ) {
    return this.tasksService.createDependency(user.tenantId, user, id, dto);
  }

  @Delete(':id/dependencies/:dependencyId')
  @RequirePermissions(PERMISSIONS.TASKS_DEPENDENCIES_WRITE)
  @ApiOperation({ summary: 'Delete task dependency' })
  @ApiParam({ name: 'id', example: 'cuid_task_1' })
  @ApiParam({ name: 'dependencyId', example: 'cuid_dependency_1' })
  @ApiOkResponse({ description: 'Dependency deleted' })
  deleteDependency(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Param('dependencyId') dependencyId: string,
  ) {
    return this.tasksService.deleteDependency(user.tenantId, user, id, dependencyId);
  }

  @Post(':id/comments')
  @RequirePermissions(PERMISSIONS.TASKS_COMMENTS_CREATE)
  @ApiOperation({ summary: 'Create task comment with mentions' })
  @ApiParam({ name: 'id', example: 'cuid_task_1' })
  @ApiBody({ type: CreateTaskCommentDto })
  @ApiCreatedResponse({ description: 'Comment created' })
  createComment(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: CreateTaskCommentDto,
  ) {
    return this.tasksService.createComment(user.tenantId, user, id, dto);
  }

  @Get(':id/comments')
  @RequirePermissions(PERMISSIONS.TASKS_COMMENTS_READ)
  @ApiOperation({ summary: 'List task comments' })
  @ApiParam({ name: 'id', example: 'cuid_task_1' })
  @ApiOkResponse({ description: 'Comment list with pagination' })
  listComments(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Query() query: ListTaskCommentsDto,
  ) {
    return this.tasksService.listComments(user.tenantId, user, id, query);
  }
}
