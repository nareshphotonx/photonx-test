import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ExternalReferenceDto } from './external-reference.dto';

export class UpdateTaskDto {
  @ApiPropertyOptional({ example: 'Refine status transition checks' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ example: 'Include reopen-count updates and validation' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @ApiPropertyOptional({ example: 'cuid_status_in_progress' })
  @IsOptional()
  @IsString()
  statusId?: string;

  @ApiPropertyOptional({ example: 'cuid_user_3' })
  @IsOptional()
  @IsString()
  assigneeId?: string | null;

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  estimateHours?: number;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ example: '2026-06-20T18:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date | null;

  @ApiPropertyOptional({ example: ['backend', 'kanban'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'cuid_milestone_2' })
  @IsOptional()
  @IsString()
  milestoneId?: string | null;

  @ApiPropertyOptional({ example: 'cuid_parent_task_1' })
  @IsOptional()
  @IsString()
  parentTaskId?: string | null;

  @ApiPropertyOptional({ type: [ExternalReferenceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalReferenceDto)
  externalReferences?: ExternalReferenceDto[];
}
