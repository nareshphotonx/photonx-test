import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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
import { AssignUserRolesDto } from './dto/assign-user-roles.dto';
import { RolesService } from './roles.service';

@ApiBearerAuth()
@ApiTags('Roles')
@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('roles')
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  @ApiOperation({ summary: 'List roles in tenant' })
  @ApiOkResponse({ description: 'Roles list' })
  listRoles(@CurrentUser() user: Express.User) {
    return this.rolesService.listRoles(user.tenantId);
  }

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.PERMISSIONS_READ)
  @ApiOperation({ summary: 'List permissions in tenant' })
  @ApiOkResponse({ description: 'Permissions list' })
  listPermissions(@CurrentUser() user: Express.User) {
    return this.rolesService.listPermissions(user.tenantId);
  }

  @Post('users/:id/roles')
  @RequirePermissions(PERMISSIONS.USER_ROLES_ASSIGN)
  @ApiOperation({ summary: 'Assign roles to user in tenant' })
  @ApiParam({ name: 'id', example: 'ckx_user_1' })
  @ApiBody({
    type: Object,
    examples: {
      default: {
        value: {
          roleCodes: ['TEAM_LEAD'],
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Roles assigned to user' })
  assignUserRoles(
    @CurrentUser() user: Express.User,
    @Param('id') userId: string,
    @Body() dto: AssignUserRolesDto,
  ) {
    return this.rolesService.assignUserRoles(
      user.tenantId,
      user.sub,
      userId,
      dto.roleCodes,
    );
  }
}
