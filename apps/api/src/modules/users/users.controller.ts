import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { CreateUserDto } from './dto/create-user.dto';
import { ImportUsersDto } from './dto/import-users.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_CREATE)
  @ApiOperation({ summary: 'Create user in current tenant' })
  @ApiBody({ type: CreateUserDto })
  @ApiCreatedResponse({ description: 'User created' })
  createUser(
    @CurrentUser() user: Express.User,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.createUser(user.tenantId, user.sub, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({ summary: 'List users in current tenant' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false, example: 'john' })
  @ApiQuery({ name: 'isActive', required: false, example: true })
  @ApiQuery({ name: 'teamId', required: false, example: 'cuid_team_1' })
  @ApiQuery({ name: 'includeDeleted', required: false, example: false })
  @ApiOkResponse({ description: 'Users list with pagination' })
  listUsers(@CurrentUser() user: Express.User, @Query() query: ListUsersDto) {
    return this.usersService.listUsers(user.tenantId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({ summary: 'Get user by id in current tenant' })
  @ApiParam({ name: 'id', example: 'ckx123user' })
  @ApiOkResponse({ description: 'User details' })
  getUserById(@CurrentUser() user: Express.User, @Param('id') id: string) {
    return this.usersService.getUserById(user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_UPDATE)
  @ApiOperation({ summary: 'Update user by id in current tenant' })
  @ApiParam({ name: 'id', example: 'ckx123user' })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ description: 'User updated' })
  updateUser(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(user.tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.USERS_DELETE)
  @ApiOperation({ summary: 'Soft delete user by id in current tenant' })
  @ApiParam({ name: 'id', example: 'ckx123user' })
  @ApiOkResponse({ description: 'User soft deleted' })
  deleteUser(@CurrentUser() user: Express.User, @Param('id') id: string) {
    return this.usersService.deleteUser(user.tenantId, user.sub, id);
  }

  @Post('import')
  @RequirePermissions(PERMISSIONS.USERS_IMPORT)
  @ApiOperation({ summary: 'Import users with batch upsert behavior' })
  @ApiBody({ type: ImportUsersDto })
  @ApiOkResponse({ description: 'Import result with partial successes and errors' })
  importUsers(
    @CurrentUser() user: Express.User,
    @Body() dto: ImportUsersDto,
  ) {
    return this.usersService.importUsers(user.tenantId, user.sub, dto);
  }
}
