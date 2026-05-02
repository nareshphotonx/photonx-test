import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ActApprovalDto } from './dto/act-approval.dto';
import { ListApprovalsDto } from './dto/list-approvals.dto';
import { ApprovalsService } from './approvals.service';

@ApiTags('Approvals')
@ApiBearerAuth()
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get('pending')
  @RequirePermissions(PERMISSIONS.APPROVALS_PENDING_READ)
  @ApiOperation({ summary: 'List pending approvals for current user scope' })
  @ApiOkResponse({ description: 'Pending approval requests' })
  listPending(@CurrentUser() user: Express.User, @Query() query: ListApprovalsDto) {
    return this.approvalsService.listPending(user.tenantId, user, query);
  }

  @Get('history')
  @RequirePermissions(PERMISSIONS.APPROVALS_HISTORY_READ)
  @ApiOperation({ summary: 'List approval history' })
  @ApiOkResponse({ description: 'Approval history entries' })
  listHistory(@CurrentUser() user: Express.User, @Query() query: ListApprovalsDto) {
    return this.approvalsService.listHistory(user.tenantId, user, query);
  }

  @Post(':id/approve')
  @RequirePermissions(PERMISSIONS.APPROVALS_APPROVE)
  @ApiOperation({ summary: 'Approve approval request by id' })
  @ApiParam({ name: 'id', example: 'cuid_approval_1' })
  @ApiBody({ type: ActApprovalDto })
  @ApiOkResponse({ description: 'Approval request approved' })
  approve(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: ActApprovalDto,
  ) {
    return this.approvalsService.approve(user.tenantId, user, id, dto);
  }

  @Post(':id/reject')
  @RequirePermissions(PERMISSIONS.APPROVALS_REJECT)
  @ApiOperation({ summary: 'Reject approval request by id' })
  @ApiParam({ name: 'id', example: 'cuid_approval_1' })
  @ApiBody({ type: ActApprovalDto })
  @ApiOkResponse({ description: 'Approval request rejected' })
  reject(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: ActApprovalDto,
  ) {
    return this.approvalsService.reject(user.tenantId, user, id, dto);
  }
}
