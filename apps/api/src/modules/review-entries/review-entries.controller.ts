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
import { CreateReviewEntryDto } from './dto/create-review-entry.dto';
import { ListReviewEntriesDto } from './dto/list-review-entries.dto';
import { ReviewEntriesService } from './review-entries.service';

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewEntriesController {
  constructor(private readonly reviewEntriesService: ReviewEntriesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.REVIEWS_CREATE)
  @ApiOperation({ summary: 'Create review entry' })
  @ApiBody({
    type: CreateReviewEntryDto,
    examples: {
      default: {
        value: {
          cycleId: 'cuid_review_cycle_1',
          reviewedUserId: 'cuid_user_1',
          overallRating: 4,
          strengths: 'Strong delivery and ownership',
          improvements: 'Can improve risk communication',
          summary: 'Consistent performance for the month.',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Review entry created' })
  createReviewEntry(@CurrentUser() user: Express.User, @Body() dto: CreateReviewEntryDto) {
    return this.reviewEntriesService.createReviewEntry(user.tenantId, user, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.REVIEWS_READ)
  @ApiOperation({ summary: 'List review entries' })
  @ApiOkResponse({
    description: 'Review entry list',
    example: {
      success: true,
      statusCode: 200,
      data: {
        page: 1,
        limit: 20,
        total: 1,
        items: [
          {
            id: 'cuid_review_entry_1',
            status: 'SUBMITTED',
            overallRating: 4,
            reviewedUser: {
              id: 'cuid_user_1',
              name: 'Standard User',
            },
          },
        ],
      },
    },
  })
  listReviewEntries(@CurrentUser() user: Express.User, @Query() query: ListReviewEntriesDto) {
    return this.reviewEntriesService.listReviewEntries(user.tenantId, user, query);
  }

  @Post(':id/submit')
  @RequirePermissions(PERMISSIONS.REVIEWS_SUBMIT)
  @ApiOperation({ summary: 'Submit draft review entry' })
  @ApiParam({ name: 'id', example: 'cuid_review_entry_1' })
  @ApiOkResponse({
    description: 'Review entry submitted',
    example: {
      success: true,
      statusCode: 200,
      data: {
        id: 'cuid_review_entry_1',
        status: 'SUBMITTED',
        submittedAt: '2026-05-31T18:00:00.000Z',
      },
    },
  })
  submitReviewEntry(@CurrentUser() user: Express.User, @Param('id') id: string) {
    return this.reviewEntriesService.submitReviewEntry(user.tenantId, user, id);
  }

  @Post(':id/approve')
  @RequirePermissions(PERMISSIONS.REVIEWS_APPROVE)
  @ApiOperation({ summary: 'Approve submitted review entry' })
  @ApiParam({ name: 'id', example: 'cuid_review_entry_1' })
  @ApiOkResponse({
    description: 'Review entry approved',
    example: {
      success: true,
      statusCode: 200,
      data: {
        id: 'cuid_review_entry_1',
        status: 'APPROVED',
        approvedAt: '2026-06-01T10:00:00.000Z',
        approvedById: 'cuid_admin_1',
      },
    },
  })
  approveReviewEntry(@CurrentUser() user: Express.User, @Param('id') id: string) {
    return this.reviewEntriesService.approveReviewEntry(user.tenantId, user, id);
  }
}
