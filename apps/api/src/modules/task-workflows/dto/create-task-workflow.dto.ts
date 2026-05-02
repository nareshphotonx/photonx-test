import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class TaskWorkflowTransitionInputDto {
  @ApiProperty({ example: 'cuid_status_todo' })
  @IsString()
  @IsNotEmpty()
  fromStatusId!: string;

  @ApiProperty({ example: 'cuid_status_progress' })
  @IsString()
  @IsNotEmpty()
  toStatusId!: string;
}

export class CreateTaskWorkflowDto {
  @ApiProperty({ example: 'cuid_project_1' })
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @ApiProperty({ example: 'default-flow' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({
    type: [TaskWorkflowTransitionInputDto],
    example: [
      { fromStatusId: 'cuid_status_todo', toStatusId: 'cuid_status_progress' },
      { fromStatusId: 'cuid_status_progress', toStatusId: 'cuid_status_done' },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TaskWorkflowTransitionInputDto)
  transitions!: TaskWorkflowTransitionInputDto[];
}
