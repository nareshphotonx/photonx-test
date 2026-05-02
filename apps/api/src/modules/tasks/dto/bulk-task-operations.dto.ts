import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class BulkTaskOperationsDto {
  @ApiProperty({
    example: ['cuid_task_1', 'cuid_task_2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  taskIds!: string[];

  @ApiPropertyOptional({ example: 'cuid_user_2' })
  @IsOptional()
  @IsString()
  assignToUserId?: string;

  @ApiPropertyOptional({ example: 'cuid_status_in_progress' })
  @IsOptional()
  @IsString()
  statusId?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(-180)
  @Max(180)
  dueDateShiftDays?: number;
}
