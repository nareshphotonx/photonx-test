import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
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
import { Request } from 'express';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AttendanceService } from './attendance.service';
import { AttendanceReportDto } from './dto/attendance-report.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { CreateRegularizationDto } from './dto/create-regularization.dto';
import { ListRegularizationDto } from './dto/list-regularization.dto';
import { RegularizationActionDto } from './dto/regularization-action.dto';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CHECK_IN)
  @ApiOperation({ summary: 'Check in user attendance for current day' })
  @ApiBody({ type: CheckInDto })
  @ApiCreatedResponse({ description: 'Check-in recorded' })
  checkIn(
    @CurrentUser() user: Express.User,
    @Req() request: Request,
    @Body() dto: CheckInDto,
  ) {
    return this.attendanceService.checkIn(user.tenantId, user, request.ip, dto);
  }

  @Post('check-out')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_CHECK_OUT)
  @ApiOperation({ summary: 'Check out user attendance for current day' })
  @ApiBody({ type: CheckOutDto })
  @ApiCreatedResponse({ description: 'Check-out recorded' })
  checkOut(
    @CurrentUser() user: Express.User,
    @Req() request: Request,
    @Body() dto: CheckOutDto,
  ) {
    return this.attendanceService.checkOut(user.tenantId, user, request.ip, dto);
  }

  @Get('today')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_TODAY_READ)
  @ApiOperation({ summary: 'Get current day attendance' })
  @ApiOkResponse({ description: 'Current day attendance data' })
  getToday(@CurrentUser() user: Express.User) {
    return this.attendanceService.getToday(user.tenantId, user);
  }

  @Get('report')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_REPORT_READ)
  @ApiOperation({ summary: 'Get attendance report by filters' })
  @ApiQuery({ name: 'from', required: false, example: '2026-06-01T00:00:00.000Z' })
  @ApiQuery({ name: 'to', required: false, example: '2026-06-30T23:59:59.000Z' })
  @ApiQuery({ name: 'userId', required: false, example: 'cuid_user_1' })
  @ApiQuery({ name: 'teamId', required: false, example: 'cuid_team_1' })
  @ApiOkResponse({ description: 'Attendance report list' })
  getReport(@CurrentUser() user: Express.User, @Query() query: AttendanceReportDto) {
    return this.attendanceService.getReport(user.tenantId, user, query);
  }

  @Post('regularization')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_REGULARIZATION_CREATE)
  @ApiOperation({ summary: 'Create attendance regularization request' })
  @ApiBody({ type: CreateRegularizationDto })
  @ApiCreatedResponse({ description: 'Regularization request created' })
  createRegularization(
    @CurrentUser() user: Express.User,
    @Body() dto: CreateRegularizationDto,
  ) {
    return this.attendanceService.createRegularization(user.tenantId, user, dto);
  }

  @Get('regularization')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_REGULARIZATION_READ)
  @ApiOperation({ summary: 'List attendance regularization requests' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @ApiQuery({ name: 'userId', required: false, example: 'cuid_user_1' })
  @ApiOkResponse({ description: 'Regularization request list' })
  listRegularization(
    @CurrentUser() user: Express.User,
    @Query() query: ListRegularizationDto,
  ) {
    return this.attendanceService.listRegularization(user.tenantId, user, query);
  }

  @Post('regularization/:id/approve')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_REGULARIZATION_APPROVE)
  @ApiOperation({ summary: 'Approve attendance regularization request' })
  @ApiParam({ name: 'id', example: 'cuid_regularization_1' })
  @ApiBody({ type: RegularizationActionDto })
  @ApiOkResponse({ description: 'Regularization request approved' })
  approveRegularization(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: RegularizationActionDto,
  ) {
    return this.attendanceService.approveRegularization(user.tenantId, user, id, dto);
  }

  @Post('regularization/:id/reject')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_REGULARIZATION_REJECT)
  @ApiOperation({ summary: 'Reject attendance regularization request' })
  @ApiParam({ name: 'id', example: 'cuid_regularization_1' })
  @ApiBody({ type: RegularizationActionDto })
  @ApiOkResponse({ description: 'Regularization request rejected' })
  rejectRegularization(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: RegularizationActionDto,
  ) {
    return this.attendanceService.rejectRegularization(user.tenantId, user, id, dto);
  }
}
