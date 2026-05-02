import { ApiPropertyOptional } from '@nestjs/swagger';
import { TimeEntrySource, TimeEntryType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListTimeEntriesDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'cuid_user_1' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ example: 'cuid_project_1' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ example: 'cuid_task_1' })
  @IsOptional()
  @IsString()
  taskId?: string;

  @ApiPropertyOptional({ enum: TimeEntrySource })
  @IsOptional()
  @IsEnum(TimeEntrySource)
  source?: TimeEntrySource;

  @ApiPropertyOptional({ enum: TimeEntryType })
  @IsOptional()
  @IsEnum(TimeEntryType)
  type?: TimeEntryType;

  @ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ example: '2026-05-31T23:59:59.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}
