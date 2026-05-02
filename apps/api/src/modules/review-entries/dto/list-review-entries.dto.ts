import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListReviewEntriesDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'cuid_review_cycle_1' })
  @IsOptional()
  @IsString()
  cycleId?: string;

  @ApiPropertyOptional({ example: 'cuid_user_1' })
  @IsOptional()
  @IsString()
  reviewedUserId?: string;

  @ApiPropertyOptional({ example: 'cuid_user_2' })
  @IsOptional()
  @IsString()
  reviewerId?: string;

  @ApiPropertyOptional({ example: 'SUBMITTED', enum: ['DRAFT', 'SUBMITTED', 'APPROVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'SUBMITTED', 'APPROVED'])
  status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
}
