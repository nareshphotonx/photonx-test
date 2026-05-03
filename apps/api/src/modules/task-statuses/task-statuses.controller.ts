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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateTaskStatusDto } from './dto/create-task-status.dto';
import { ListTaskStatusesDto } from './dto/list-task-statuses.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TaskStatusesService } from './task-statuses.service';

@ApiTags('Task Statuses')
@ApiBearerAuth()
@Controller('task-statuses')
export class TaskStatusesController {
  constructor(private readonly service: TaskStatusesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.TASK_STATUSES_CREATE)
  @ApiOperation({ summary: 'Create task status for project' })
  @ApiBody({ type: CreateTaskStatusDto })
  @ApiCreatedResponse({ description: 'Task status created' })
  createStatus(@CurrentUser() user: Express.User, @Body() dto: CreateTaskStatusDto) {
    return this.service.createStatus(user.tenantId, user, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.TASK_STATUSES_READ)
  @ApiOperation({ summary: 'List task statuses for project' })
  @ApiQuery({ name: 'projectId', required: true, example: 'cuid_project_1' })
  @ApiOkResponse({ description: 'Task status list' })
  listStatuses(
    @CurrentUser() user: Express.User,
    @Query() query: ListTaskStatusesDto,
  ) {
    return this.service.listStatuses(user.tenantId, user, query);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TASK_STATUSES_UPDATE)
  @ApiOperation({ summary: 'Update task status' })
  @ApiParam({ name: 'id', example: 'cuid_status_1' })
  @ApiBody({ type: UpdateTaskStatusDto })
  @ApiOkResponse({ description: 'Task status updated' })
  updateStatus(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.service.updateStatus(user.tenantId, user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.TASK_STATUSES_DELETE)
  @ApiOperation({ summary: 'Delete task status' })
  @ApiParam({ name: 'id', example: 'cuid_status_1' })
  @ApiOkResponse({ description: 'Task status deleted' })
  deleteStatus(@CurrentUser() user: Express.User, @Param('id') id: string) {
    return this.service.deleteStatus(user.tenantId, user, id);
  }
}
