import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewEntryDto {
  @ApiProperty({ example: 'cuid_review_cycle_1' })
  @IsString()
  cycleId!: string;

  @ApiProperty({ example: 'cuid_user_1' })
  @IsString()
  reviewedUserId!: string;

  @ApiProperty({ example: 4, minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating!: number;

  @ApiPropertyOptional({ example: 'Consistent delivery, proactive ownership.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  strengths?: string;

  @ApiPropertyOptional({ example: 'Can improve sprint estimation accuracy.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  improvements?: string;

  @ApiPropertyOptional({ example: 'Strong month with clear impact on team throughput.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string;
}
