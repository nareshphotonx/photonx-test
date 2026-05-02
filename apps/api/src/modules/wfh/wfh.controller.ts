import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
import { CreateWfhPolicyDto } from './dto/create-wfh-policy.dto';
import { CreateWfhRequestDto } from './dto/create-wfh-request.dto';
import { ListWfhRequestsDto } from './dto/list-wfh-requests.dto';
import { WfhActionDto } from './dto/wfh-action.dto';
import { WfhBalanceDto } from './dto/wfh-balance.dto';
import { WfhService } from './wfh.service';

@ApiTags('WFH')
@ApiBearerAuth()
@Controller('wfh')
export class WfhController {
  constructor(private readonly wfhService: WfhService) {}

  @Post('policies')
  @RequirePermissions(PERMISSIONS.WFH_POLICIES_CREATE)
  @ApiOperation({ summary: 'Create or update WFH policy' })
  @ApiBody({ type: CreateWfhPolicyDto })
  @ApiCreatedResponse({ description: 'WFH policy upserted' })
  createPolicy(@CurrentUser() user: Express.User, @Body() dto: CreateWfhPolicyDto) {
    return this.wfhService.createPolicy(user.tenantId, user, dto);
  }

  @Get('balance/me')
  @RequirePermissions(PERMISSIONS.WFH_BALANCE_ME_READ)
  @ApiOperation({ summary: 'Get WFH balance for current user' })
  @ApiOkResponse({ description: 'Current user WFH balance' })
  getMyBalance(@CurrentUser() user: Express.User, @Query() query: WfhBalanceDto) {
    return this.wfhService.getMyBalance(user.tenantId, user, query);
  }

  @Get('balance/:userId')
  @RequirePermissions(PERMISSIONS.WFH_BALANCE_USER_READ)
  @ApiOperation({ summary: 'Get WFH balance by user id' })
  @ApiParam({ name: 'userId', example: 'cuid_user_1' })
  @ApiOkResponse({ description: 'User WFH balance' })
  getUserBalance(
    @CurrentUser() user: Express.User,
    @Param('userId') userId: string,
    @Query() query: WfhBalanceDto,
  ) {
    return this.wfhService.getBalance(user.tenantId, user, userId, query);
  }

  @Post('requests')
  @RequirePermissions(PERMISSIONS.WFH_REQUESTS_CREATE)
  @ApiOperation({ summary: 'Create WFH request' })
  @ApiBody({ type: CreateWfhRequestDto })
  @ApiCreatedResponse({ description: 'WFH request created' })
  createRequest(
    @CurrentUser() user: Express.User,
    @Body() dto: CreateWfhRequestDto,
  ) {
    return this.wfhService.createRequest(user.tenantId, user, dto);
  }

  @Get('requests')
  @RequirePermissions(PERMISSIONS.WFH_REQUESTS_READ)
  @ApiOperation({ summary: 'List WFH requests' })
  @ApiOkResponse({ description: 'WFH request list' })
  listRequests(
    @CurrentUser() user: Express.User,
    @Query() query: ListWfhRequestsDto,
  ) {
    return this.wfhService.listRequests(user.tenantId, user, query);
  }

  @Post('requests/:id/approve')
  @RequirePermissions(PERMISSIONS.WFH_REQUESTS_APPROVE)
  @ApiOperation({ summary: 'Approve WFH request' })
  @ApiParam({ name: 'id', example: 'cuid_wfh_req_1' })
  @ApiBody({ type: WfhActionDto })
  @ApiOkResponse({ description: 'WFH request approved' })
  approveRequest(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: WfhActionDto,
  ) {
    return this.wfhService.approveRequest(user.tenantId, user, id, dto);
  }

  @Post('requests/:id/reject')
  @RequirePermissions(PERMISSIONS.WFH_REQUESTS_REJECT)
  @ApiOperation({ summary: 'Reject WFH request' })
  @ApiParam({ name: 'id', example: 'cuid_wfh_req_1' })
  @ApiBody({ type: WfhActionDto })
  @ApiOkResponse({ description: 'WFH request rejected' })
  rejectRequest(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: WfhActionDto,
  ) {
    return this.wfhService.rejectRequest(user.tenantId, user, id, dto);
  }
}
