import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateReviewCycleDto } from './dto/create-review-cycle.dto';
import { ListReviewCyclesDto } from './dto/list-review-cycles.dto';
import { ReviewCyclesService } from './review-cycles.service';

@ApiTags('Review Cycles')
@ApiBearerAuth()
@Controller('review-cycles')
export class ReviewCyclesController {
  constructor(private readonly reviewCyclesService: ReviewCyclesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.REVIEW_CYCLES_CREATE)
  @ApiOperation({ summary: 'Create monthly review cycle' })
  @ApiBody({
    type: CreateReviewCycleDto,
    examples: {
      default: {
        value: {
          year: 2026,
          month: 5,
          title: 'May 2026 Performance Review',
          startDate: '2026-05-01T00:00:00.000Z',
          endDate: '2026-05-31T23:59:59.000Z',
          notes: 'Monthly review cycle for engineering teams.',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Review cycle created' })
  createReviewCycle(@CurrentUser() user: Express.User, @Body() dto: CreateReviewCycleDto) {
    return this.reviewCyclesService.createReviewCycle(user.tenantId, user, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.REVIEW_CYCLES_READ)
  @ApiOperation({ summary: 'List review cycles' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false, example: 'May 2026' })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  @ApiQuery({ name: 'month', required: false, example: 5 })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'OPEN', 'CLOSED'] })
  @ApiOkResponse({
    description: 'Review cycle list',
    example: {
      success: true,
      statusCode: 200,
      data: {
        page: 1,
        limit: 20,
        total: 1,
        items: [
          {
            id: 'cuid_review_cycle_1',
            year: 2026,
            month: 5,
            title: 'May 2026 Performance Review',
            status: 'OPEN',
          },
        ],
      },
    },
  })
  listReviewCycles(@Query() query: ListReviewCyclesDto, @CurrentUser() user: Express.User) {
    return this.reviewCyclesService.listReviewCycles(user.tenantId, query);
  }
}
