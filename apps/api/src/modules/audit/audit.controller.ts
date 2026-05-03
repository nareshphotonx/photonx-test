import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { Role } from '../../common/enums/role.enum';
import { Roles } from '../../common/decorators/roles.decorator';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @RequirePermissions(PERMISSIONS.AUDIT_LOGS_READ)
  @ApiOperation({ summary: 'List tenant audit logs (SUPER_ADMIN only)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'action', required: false, example: 'TASK_STATUS_CHANGE' })
  @ApiQuery({ name: 'actorId', required: false, example: 'cuid_user_1' })
  @ApiQuery({ name: 'entityType', required: false, example: 'Task' })
  @ApiQuery({ name: 'entityId', required: false, example: 'cuid_task_1' })
  @ApiQuery({ name: 'from', required: false, example: '2026-05-01T00:00:00.000Z' })
  @ApiQuery({ name: 'to', required: false, example: '2026-05-31T23:59:59.000Z' })
  @ApiQuery({ name: 'search', required: false, example: 'TASK' })
  @ApiOkResponse({
    description: 'Audit log list',
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
            id: 'cuid_audit_1',
            action: 'TASK_STATUS_CHANGE',
            entityType: 'Task',
            entityId: 'cuid_task_1',
            requestId: 'f6efcad2-c2f4-468e-af3d-42ebb686f1be',
            createdAt: '2026-05-02T10:00:00.000Z',
          },
        ],
      },
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
  @ApiForbiddenResponse({
    description: 'Forbidden for non-super-admin users',
    example: {
      success: false,
      statusCode: 403,
      message: 'Forbidden resource',
      error: 'Forbidden',
      errorCode: 'AUTH_FORBIDDEN',
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters',
    example: {
      success: false,
      statusCode: 400,
      message: 'Validation failed',
      error: 'Bad Request',
      errorCode: 'VALIDATION_ERROR',
    },
  })
  listAuditLogs(@CurrentUser() user: Express.User, @Query() query: ListAuditLogsDto) {
    return this.auditService.listLogs(user.tenantId, query);
  }
}
