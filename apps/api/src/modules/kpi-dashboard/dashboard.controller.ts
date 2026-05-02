import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DashboardRangeDto } from './dto/dashboard-range.dto';
import { DashboardService } from './dashboard.service';

@ApiTags('KPI Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('super-admin')
  @RequirePermissions(PERMISSIONS.DASHBOARD_SUPER_ADMIN_READ)
  @ApiOperation({ summary: 'Get tenant-wide KPI dashboard for SUPER_ADMIN' })
  @ApiQuery({ name: 'from', required: false, example: '2026-04-01T00:00:00.000Z' })
  @ApiQuery({ name: 'to', required: false, example: '2026-04-30T23:59:59.000Z' })
  @ApiOkResponse({
    description: 'Tenant KPI dashboard',
    example: {
      success: true,
      statusCode: 200,
      data: {
        scope: 'SUPER_ADMIN',
        kpis: {
          efficiency: 1.12,
          utilization: 0.78,
          completionRate: 0.84,
        },
      },
    },
  })
  getSuperAdminDashboard(
    @CurrentUser() user: Express.User,
    @Query() query: DashboardRangeDto,
  ) {
    return this.dashboardService.getSuperAdminDashboard(user.tenantId, user, query);
  }

  @Get('team-lead')
  @RequirePermissions(PERMISSIONS.DASHBOARD_TEAM_LEAD_READ)
  @ApiOperation({ summary: 'Get team-scoped KPI dashboard for TEAM_LEAD' })
  @ApiQuery({ name: 'from', required: false, example: '2026-04-01T00:00:00.000Z' })
  @ApiQuery({ name: 'to', required: false, example: '2026-04-30T23:59:59.000Z' })
  @ApiOkResponse({
    description: 'Team KPI dashboard',
    example: {
      success: true,
      statusCode: 200,
      data: {
        scope: 'TEAM_LEAD',
        teamIds: ['team_1'],
        kpis: {
          efficiency: 1.05,
          delayRate: 0.12,
          reopenRate: 0.08,
        },
      },
    },
  })
  getTeamLeadDashboard(
    @CurrentUser() user: Express.User,
    @Query() query: DashboardRangeDto,
  ) {
    return this.dashboardService.getTeamLeadDashboard(user.tenantId, user, query);
  }

  @Get('user-performance/:userId')
  @RequirePermissions(PERMISSIONS.DASHBOARD_USER_PERFORMANCE_READ)
  @ApiOperation({ summary: 'Get user performance KPI dashboard' })
  @ApiParam({ name: 'userId', example: 'cuid_user_1' })
  @ApiQuery({ name: 'from', required: false, example: '2026-04-01T00:00:00.000Z' })
  @ApiQuery({ name: 'to', required: false, example: '2026-04-30T23:59:59.000Z' })
  @ApiOkResponse({
    description: 'User KPI dashboard',
    example: {
      success: true,
      statusCode: 200,
      data: {
        scope: 'USER_PERFORMANCE',
        user: {
          id: 'cuid_user_1',
          name: 'Standard User',
        },
        kpis: {
          completionRate: 0.9,
          utilization: 0.82,
        },
      },
    },
  })
  getUserPerformance(
    @CurrentUser() user: Express.User,
    @Param('userId') userId: string,
    @Query() query: DashboardRangeDto,
  ) {
    return this.dashboardService.getUserPerformance(user.tenantId, user, userId, query);
  }

  @Get('project/:projectId')
  @RequirePermissions(PERMISSIONS.DASHBOARD_PROJECT_READ)
  @ApiOperation({ summary: 'Get project KPI dashboard' })
  @ApiParam({ name: 'projectId', example: 'cuid_project_1' })
  @ApiQuery({ name: 'from', required: false, example: '2026-04-01T00:00:00.000Z' })
  @ApiQuery({ name: 'to', required: false, example: '2026-04-30T23:59:59.000Z' })
  @ApiOkResponse({
    description: 'Project KPI dashboard',
    example: {
      success: true,
      statusCode: 200,
      data: {
        project: {
          id: 'cuid_project_1',
          code: 'T',
        },
        financials: {
          totalBurn: 125000,
          margin: 0.18,
        },
      },
    },
  })
  getProjectDashboard(
    @CurrentUser() user: Express.User,
    @Param('projectId') projectId: string,
    @Query() query: DashboardRangeDto,
  ) {
    return this.dashboardService.getProjectDashboard(user.tenantId, user, projectId, query);
  }
}
