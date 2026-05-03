import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { type Request } from 'express';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CheckOfficePolicyDto } from './dto/check-office-policy.dto';
import { CreateOfficeIpDto } from './dto/create-office-ip.dto';
import { CreateOfficeLocationDto } from './dto/create-office-location.dto';
import { OfficePolicyService } from './office-policy.service';

@ApiTags('Office Policy')
@ApiBearerAuth()
@Controller()
export class OfficePolicyController {
  constructor(private readonly officePolicyService: OfficePolicyService) {}

  @Post('office-locations')
  @RequirePermissions(PERMISSIONS.OFFICE_LOCATIONS_CREATE)
  @ApiOperation({ summary: 'Create office location' })
  @ApiBody({ type: CreateOfficeLocationDto })
  @ApiCreatedResponse({ description: 'Office location created' })
  createOfficeLocation(
    @CurrentUser() user: Express.User,
    @Body() dto: CreateOfficeLocationDto,
  ) {
    return this.officePolicyService.createOfficeLocation(user.tenantId, user.sub, dto);
  }

  @Get('office-locations')
  @RequirePermissions(PERMISSIONS.OFFICE_LOCATIONS_READ)
  @ApiOperation({ summary: 'List office locations' })
  @ApiOkResponse({ description: 'Office locations' })
  listOfficeLocations(@CurrentUser() user: Express.User) {
    return this.officePolicyService.listOfficeLocations(user.tenantId);
  }

  @Post('office-ips')
  @RequirePermissions(PERMISSIONS.OFFICE_IPS_CREATE)
  @ApiOperation({ summary: 'Create office IP allowlist rule' })
  @ApiCreatedResponse({ description: 'Office IP rule created' })
  @ApiBody({
    type: Object,
    examples: {
      default: {
        value: {
          cidr: '203.0.113.0/24',
          label: 'Main office broadband',
        },
      },
    },
  })
  createOfficeIp(
    @CurrentUser() user: Express.User,
    @Body() dto: CreateOfficeIpDto,
  ) {
    return this.officePolicyService.createOfficeIp(user.tenantId, user.sub, dto);
  }

  @Get('office-ips')
  @RequirePermissions(PERMISSIONS.OFFICE_IPS_READ)
  @ApiOperation({ summary: 'List office IP allowlist rules' })
  @ApiOkResponse({ description: 'Office IP rules' })
  listOfficeIps(@CurrentUser() user: Express.User) {
    return this.officePolicyService.listOfficeIps(user.tenantId);
  }

  @Get('office-policy/check')
  @RequirePermissions(PERMISSIONS.OFFICE_POLICY_CHECK)
  @ApiOperation({ summary: 'Check office policy using source IP' })
  @ApiQuery({ name: 'ipAddress', required: false, example: '203.0.113.10' })
  @ApiQuery({ name: 'latitude', required: false, example: 12.97 })
  @ApiQuery({ name: 'longitude', required: false, example: 77.59 })
  @ApiOkResponse({ description: 'Policy check result' })
  checkOfficePolicy(
    @CurrentUser() user: Express.User,
    @Req() request: Request,
    @Query() query: CheckOfficePolicyDto,
  ) {
    return this.officePolicyService.checkPolicy(user.tenantId, request.ip, query);
  }
}
