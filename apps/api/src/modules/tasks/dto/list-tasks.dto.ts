import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListTasksDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'cuid_project_1' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ example: 'cuid_status_todo' })
  @IsOptional()
  @IsString()
  statusId?: string;

  @ApiPropertyOptional({ example: 'cuid_user_1' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ example: 'cuid_milestone_1' })
  @IsOptional()
  @IsString()
  milestoneId?: string;

  @ApiPropertyOptional({ example: 'cuid_parent_task_1' })
  @IsOptional()
  @IsString()
  parentTaskId?: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueAfter?: Date;

  @ApiPropertyOptional({ example: '2026-06-30T23:59:59.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueBefore?: Date;
}
