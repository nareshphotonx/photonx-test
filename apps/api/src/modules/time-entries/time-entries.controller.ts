import {
  Body,
  Controller,
  Get,
  Param,
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
import { AdjustTimeEntryDto } from './dto/adjust-time-entry.dto';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { ListTimeEntriesDto } from './dto/list-time-entries.dto';
import { ManagerBulkTimeEntriesDto } from './dto/manager-bulk-time-entries.dto';
import { TimeEntriesSummaryDto } from './dto/time-entries-summary.dto';
import { UnlockTimeEntryDto } from './dto/unlock-time-entry.dto';
import { TimeEntriesService } from './time-entries.service';

@ApiTags('Time Entries')
@ApiBearerAuth()
@Controller('time-entries')
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.TIME_ENTRIES_CREATE)
  @ApiOperation({ summary: 'Create append-only time entry' })
  @ApiBody({
    type: CreateTimeEntryDto,
    examples: {
      manual: {
        value: {
          projectId: 'cuid_project_1',
          taskId: 'cuid_task_1',
          entryDate: '2026-05-02T00:00:00.000Z',
          hours: 6.5,
          source: 'MANUAL',
          note: 'Worked on workflow integration',
          externalRef: 'GH-PR-102',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Time entry created' })
  createTimeEntry(
    @CurrentUser() user: Express.User,
    @Body() dto: CreateTimeEntryDto,
  ) {
    return this.timeEntriesService.createTimeEntry(user.tenantId, user, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.TIME_ENTRIES_READ)
  @ApiOperation({ summary: 'List time entries with filters' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'userId', required: false, example: 'cuid_user_1' })
  @ApiQuery({ name: 'projectId', required: false, example: 'cuid_project_1' })
  @ApiQuery({ name: 'taskId', required: false, example: 'cuid_task_1' })
  @ApiQuery({
    name: 'source',
    required: false,
    enum: ['MANUAL', 'WHATSAPP', 'GITHUB_PROMPT', 'MANAGER_BULK'],
  })
  @ApiQuery({ name: 'type', required: false, enum: ['WORK', 'ADJUSTMENT'] })
  @ApiQuery({ name: 'from', required: false, example: '2026-05-01T00:00:00.000Z' })
  @ApiQuery({ name: 'to', required: false, example: '2026-05-31T23:59:59.000Z' })
  @ApiOkResponse({ description: 'Paginated time entry list' })
  listTimeEntries(
    @CurrentUser() user: Express.User,
    @Query() query: ListTimeEntriesDto,
  ) {
    return this.timeEntriesService.listTimeEntries(user.tenantId, user, query);
  }

  @Get('summary')
  @RequirePermissions(PERMISSIONS.TIME_ENTRIES_SUMMARY_READ)
  @ApiOperation({ summary: 'Get daily time and cost summary' })
  @ApiQuery({ name: 'userId', required: false, example: 'cuid_user_1' })
  @ApiQuery({ name: 'projectId', required: false, example: 'cuid_project_1' })
  @ApiQuery({ name: 'from', required: false, example: '2026-05-01T00:00:00.000Z' })
  @ApiQuery({ name: 'to', required: false, example: '2026-05-31T23:59:59.000Z' })
  @ApiOkResponse({ description: 'Daily grouped time summary' })
  getSummary(
    @CurrentUser() user: Express.User,
    @Query() query: TimeEntriesSummaryDto,
  ) {
    return this.timeEntriesService.getSummary(user.tenantId, user, query);
  }

  @Post('manager-bulk')
  @RequirePermissions(PERMISSIONS.TIME_ENTRIES_MANAGER_BULK)
  @ApiOperation({ summary: 'Create manager bulk time entries' })
  @ApiBody({ type: ManagerBulkTimeEntriesDto })
  @ApiOkResponse({ description: 'Bulk time entry result with row-level errors' })
  managerBulkCreate(
    @CurrentUser() user: Express.User,
    @Body() dto: ManagerBulkTimeEntriesDto,
  ) {
    return this.timeEntriesService.managerBulkCreate(user.tenantId, user, dto);
  }

  @Post(':id/adjust')
  @RequirePermissions(PERMISSIONS.TIME_ENTRIES_ADJUST)
  @ApiOperation({ summary: 'Create time entry adjustment row' })
  @ApiParam({ name: 'id', example: 'cuid_time_entry_1' })
  @ApiBody({
    type: AdjustTimeEntryDto,
    examples: {
      negative: {
        value: {
          hoursDelta: -1.25,
          reason: 'Correction for over-logged work',
          note: 'Approved in standup',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Adjustment entry created' })
  adjustTimeEntry(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: AdjustTimeEntryDto,
  ) {
    return this.timeEntriesService.adjustTimeEntry(user.tenantId, user, id, dto);
  }

  @Post(':id/unlock')
  @RequirePermissions(PERMISSIONS.TIME_ENTRIES_UNLOCK)
  @ApiOperation({ summary: 'Unlock a locked time entry with reason' })
  @ApiParam({ name: 'id', example: 'cuid_time_entry_1' })
  @ApiBody({
    type: UnlockTimeEntryDto,
    examples: {
      default: {
        value: {
          reason: 'Payroll correction approved',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Time entry unlocked' })
  unlockTimeEntry(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: UnlockTimeEntryDto,
  ) {
    return this.timeEntriesService.unlockTimeEntry(user.tenantId, user, id, dto);
  }
}
