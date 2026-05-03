import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
import { CreateLeavePolicyDto } from './dto/create-leave-policy.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { LeaveActionDto } from './dto/leave-action.dto';
import { LeaveBalanceDto } from './dto/leave-balance.dto';
import { ListLeaveRequestsDto } from './dto/list-leave-requests.dto';
import { LeaveService } from './leave.service';

@ApiTags('Leave')
@ApiBearerAuth()
@Controller()
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post('leave-types')
  @RequirePermissions(PERMISSIONS.LEAVE_TYPES_CREATE)
  @ApiOperation({ summary: 'Create leave type' })
  @ApiBody({ type: CreateLeaveTypeDto })
  @ApiCreatedResponse({ description: 'Leave type created' })
  createLeaveType(@CurrentUser() user: Express.User, @Body() dto: CreateLeaveTypeDto) {
    return this.leaveService.createLeaveType(user.tenantId, user, dto);
  }

  @Get('leave-types')
  @RequirePermissions(PERMISSIONS.LEAVE_TYPES_READ)
  @ApiOperation({ summary: 'List leave types' })
  @ApiOkResponse({ description: 'Leave type list' })
  listLeaveTypes(@CurrentUser() user: Express.User) {
    return this.leaveService.listLeaveTypes(user.tenantId);
  }

  @Post('leave-policies')
  @RequirePermissions(PERMISSIONS.LEAVE_POLICIES_CREATE)
  @ApiOperation({ summary: 'Create or update leave policy and overrides' })
  @ApiBody({ type: CreateLeavePolicyDto })
  @ApiCreatedResponse({ description: 'Leave policy upserted' })
  createLeavePolicy(@CurrentUser() user: Express.User, @Body() dto: CreateLeavePolicyDto) {
    return this.leaveService.createLeavePolicy(user.tenantId, user, dto);
  }

  @Get('leave/balance/me')
  @RequirePermissions(PERMISSIONS.LEAVE_BALANCE_ME_READ)
  @ApiOperation({ summary: 'Get leave balance for current user' })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  @ApiOkResponse({ description: 'Current user leave balance' })
  getMyBalance(@CurrentUser() user: Express.User, @Query() query: LeaveBalanceDto) {
    return this.leaveService.getMyBalance(user.tenantId, user, query);
  }

  @Get('leave/balance/:userId')
  @RequirePermissions(PERMISSIONS.LEAVE_BALANCE_USER_READ)
  @ApiOperation({ summary: 'Get leave balance by user id' })
  @ApiParam({ name: 'userId', example: 'cuid_user_1' })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  @ApiOkResponse({ description: 'User leave balance' })
  getUserBalance(
    @CurrentUser() user: Express.User,
    @Param('userId') userId: string,
    @Query() query: LeaveBalanceDto,
  ) {
    return this.leaveService.getBalance(user.tenantId, user, userId, query);
  }

  @Post('leave/requests')
  @RequirePermissions(PERMISSIONS.LEAVE_REQUESTS_CREATE)
  @ApiOperation({ summary: 'Create leave request' })
  @ApiBody({ type: CreateLeaveRequestDto })
  @ApiCreatedResponse({ description: 'Leave request created' })
  createLeaveRequest(
    @CurrentUser() user: Express.User,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.leaveService.createLeaveRequest(user.tenantId, user, dto);
  }

  @Get('leave/requests')
  @RequirePermissions(PERMISSIONS.LEAVE_REQUESTS_READ)
  @ApiOperation({ summary: 'List leave requests' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @ApiQuery({ name: 'userId', required: false, example: 'cuid_user_1' })
  @ApiQuery({ name: 'from', required: false, example: '2026-07-01T00:00:00.000Z' })
  @ApiQuery({ name: 'to', required: false, example: '2026-07-31T00:00:00.000Z' })
  @ApiOkResponse({ description: 'Leave request list' })
  listLeaveRequests(
    @CurrentUser() user: Express.User,
    @Query() query: ListLeaveRequestsDto,
  ) {
    return this.leaveService.listLeaveRequests(user.tenantId, user, query);
  }

  @Post('leave/requests/:id/approve')
  @RequirePermissions(PERMISSIONS.LEAVE_REQUESTS_APPROVE)
  @ApiOperation({ summary: 'Approve leave request' })
  @ApiParam({ name: 'id', example: 'cuid_leave_req_1' })
  @ApiBody({ type: LeaveActionDto })
  @ApiOkResponse({ description: 'Leave request approved' })
  approveLeave(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: LeaveActionDto,
  ) {
    return this.leaveService.approveLeaveRequest(user.tenantId, user, id, dto);
  }

  @Post('leave/requests/:id/reject')
  @RequirePermissions(PERMISSIONS.LEAVE_REQUESTS_REJECT)
  @ApiOperation({ summary: 'Reject leave request' })
  @ApiParam({ name: 'id', example: 'cuid_leave_req_1' })
  @ApiBody({ type: LeaveActionDto })
  @ApiOkResponse({ description: 'Leave request rejected' })
  rejectLeave(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: LeaveActionDto,
  ) {
    return this.leaveService.rejectLeaveRequest(user.tenantId, user, id, dto);
  }
}
