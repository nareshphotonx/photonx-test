import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
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
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { ListHolidaysDto } from './dto/list-holidays.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { HolidaysService } from './holidays.service';

@ApiTags('Holidays')
@ApiBearerAuth()
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.HOLIDAYS_CREATE)
  @ApiOperation({ summary: 'Create holiday' })
  @ApiBody({ type: CreateHolidayDto })
  @ApiCreatedResponse({ description: 'Holiday created' })
  createHoliday(@CurrentUser() user: Express.User, @Body() dto: CreateHolidayDto) {
    return this.holidaysService.createHoliday(user.tenantId, user, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.HOLIDAYS_READ)
  @ApiOperation({ summary: 'List holidays' })
  @ApiOkResponse({ description: 'Holiday list' })
  listHolidays(@CurrentUser() user: Express.User, @Query() query: ListHolidaysDto) {
    return this.holidaysService.listHolidays(user.tenantId, query);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.HOLIDAYS_UPDATE)
  @ApiOperation({ summary: 'Update holiday by id' })
  @ApiParam({ name: 'id', example: 'cuid_holiday_1' })
  @ApiBody({ type: UpdateHolidayDto })
  @ApiOkResponse({ description: 'Holiday updated' })
  updateHoliday(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: UpdateHolidayDto,
  ) {
    return this.holidaysService.updateHoliday(user.tenantId, user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.HOLIDAYS_DELETE)
  @ApiOperation({ summary: 'Delete holiday by id' })
  @ApiParam({ name: 'id', example: 'cuid_holiday_1' })
  @ApiOkResponse({ description: 'Holiday deleted' })
  deleteHoliday(@CurrentUser() user: Express.User, @Param('id') id: string) {
    return this.holidaysService.deleteHoliday(user.tenantId, user, id);
  }

  @Post(':id/claim-optional')
  @RequirePermissions(PERMISSIONS.HOLIDAYS_CLAIM_OPTIONAL)
  @ApiOperation({ summary: 'Claim optional holiday for current user' })
  @ApiParam({ name: 'id', example: 'cuid_holiday_1' })
  @ApiOkResponse({ description: 'Optional holiday claimed' })
  claimOptionalHoliday(@CurrentUser() user: Express.User, @Param('id') id: string) {
    return this.holidaysService.claimOptionalHoliday(user.tenantId, user, id);
  }
}
