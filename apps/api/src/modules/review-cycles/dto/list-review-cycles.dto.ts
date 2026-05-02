import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListReviewCyclesDto extends PaginationDto {
  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(2000)
  year?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  month?: number;

  @ApiPropertyOptional({ example: 'OPEN', enum: ['DRAFT', 'OPEN', 'CLOSED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'OPEN', 'CLOSED'])
  status?: 'DRAFT' | 'OPEN' | 'CLOSED';
}
