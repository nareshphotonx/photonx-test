import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ExternalReferenceDto } from './external-reference.dto';

export class CreateTaskDto {
  @ApiProperty({ example: 'cuid_project_1' })
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @ApiProperty({ example: 'Implement status transition checks' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional({ example: 'Validate workflow transitions before state updates' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @ApiProperty({ example: 'cuid_status_todo' })
  @IsString()
  @IsNotEmpty()
  statusId!: string;

  @ApiPropertyOptional({ example: 'cuid_user_2' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ example: 14.5 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  estimateHours?: number;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ example: '2026-06-12T18:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;

  @ApiPropertyOptional({ example: ['backend', 'rbac'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'cuid_milestone_1' })
  @IsOptional()
  @IsString()
  milestoneId?: string;

  @ApiPropertyOptional({ example: 'cuid_task_parent_1' })
  @IsOptional()
  @IsString()
  parentTaskId?: string;

  @ApiPropertyOptional({ type: [ExternalReferenceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalReferenceDto)
  externalReferences?: ExternalReferenceDto[];
}
