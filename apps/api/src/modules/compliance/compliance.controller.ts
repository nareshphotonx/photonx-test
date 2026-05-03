import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ComplianceService } from './compliance.service';
import { CreateDataErasureRequestDto } from './dto/create-data-erasure-request.dto';
import { CreateDataExportRequestDto } from './dto/create-data-export-request.dto';
import { ListComplianceRequestsDto } from './dto/list-compliance-requests.dto';

@ApiTags('Compliance')
@ApiBearerAuth()
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Post('data-export')
  @RequirePermissions(PERMISSIONS.COMPLIANCE_DATA_EXPORT_CREATE)
  @ApiOperation({ summary: 'Create self-service compliance data export request' })
  @ApiBody({ type: CreateDataExportRequestDto })
  @ApiCreatedResponse({
    description: 'Data export request created',
    example: {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: {
        id: 'cuid_compliance_1',
        type: 'DATA_EXPORT',
        status: 'PENDING',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request payload',
    example: {
      success: false,
      statusCode: 400,
      message: 'Validation failed',
      error: 'Bad Request',
      errorCode: 'VALIDATION_ERROR',
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized request',
    example: {
      success: false,
      statusCode: 401,
      message: 'Unauthorized',
      error: 'Unauthorized',
      errorCode: 'AUTH_UNAUTHORIZED',
    },
  })
  createDataExportRequest(
    @CurrentUser() user: Express.User,
    @Body() dto: CreateDataExportRequestDto,
  ) {
    return this.complianceService.createDataExportRequest(user.tenantId, user, dto);
  }

  @Post('data-erasure')
  @RequirePermissions(PERMISSIONS.COMPLIANCE_DATA_ERASURE_CREATE)
  @ApiOperation({ summary: 'Create self-service compliance data erasure request' })
  @ApiBody({ type: CreateDataErasureRequestDto })
  @ApiCreatedResponse({
    description: 'Data erasure request created',
    example: {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: {
        id: 'cuid_compliance_2',
        type: 'DATA_ERASURE',
        status: 'PENDING',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request payload or missing confirmation',
    example: {
      success: false,
      statusCode: 400,
      message: 'Erasure confirmation must be true',
      error: 'Bad Request',
      errorCode: 'VALIDATION_ERROR',
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized request',
    example: {
      success: false,
      statusCode: 401,
      message: 'Unauthorized',
      error: 'Unauthorized',
      errorCode: 'AUTH_UNAUTHORIZED',
    },
  })
  createDataErasureRequest(
    @CurrentUser() user: Express.User,
    @Body() dto: CreateDataErasureRequestDto,
  ) {
    return this.complianceService.createDataErasureRequest(user.tenantId, user, dto);
  }

  @Get('requests')
  @RequirePermissions(PERMISSIONS.COMPLIANCE_REQUESTS_READ)
  @ApiOperation({ summary: 'List compliance requests in permitted scope' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'type', required: false, enum: ['DATA_EXPORT', 'DATA_ERASURE'] })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] })
  @ApiQuery({ name: 'from', required: false, example: '2026-05-01T00:00:00.000Z' })
  @ApiQuery({ name: 'to', required: false, example: '2026-05-31T23:59:59.000Z' })
  @ApiQuery({ name: 'userId', required: false, example: 'cuid_user_1' })
  @ApiOkResponse({
    description: 'Compliance request list',
    example: {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        page: 1,
        limit: 20,
        total: 1,
        items: [
          {
            id: 'cuid_compliance_1',
            type: 'DATA_EXPORT',
            status: 'COMPLETED',
            createdAt: '2026-05-02T10:10:00.000Z',
          },
        ],
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'Forbidden for out-of-scope query',
    example: {
      success: false,
      statusCode: 403,
      message: 'Only SUPER_ADMIN can filter by userId for compliance requests',
      error: 'Forbidden',
      errorCode: 'AUTH_FORBIDDEN',
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized request',
    example: {
      success: false,
      statusCode: 401,
      message: 'Unauthorized',
      error: 'Unauthorized',
      errorCode: 'AUTH_UNAUTHORIZED',
    },
  })
  listRequests(
    @CurrentUser() user: Express.User,
    @Query() query: ListComplianceRequestsDto,
  ) {
    return this.complianceService.listRequests(user.tenantId, user, query);
  }
}
