import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TimeEntrySource } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTimeEntryDto {
  @ApiProperty({ example: 'cuid_project_1' })
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @ApiPropertyOptional({ example: 'cuid_task_1' })
  @IsOptional()
  @IsString()
  taskId?: string;

  @ApiProperty({ example: '2026-05-02T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  entryDate!: Date;

  @ApiProperty({ example: 6.5, description: 'Must be in 0.25 increments' })
  @IsNumber()
  @Min(0.25)
  hours!: number;

  @ApiProperty({ enum: TimeEntrySource, example: TimeEntrySource.MANUAL })
  @IsEnum(TimeEntrySource)
  source!: TimeEntrySource;

  @ApiPropertyOptional({ example: 'Worked on workflow integration' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ example: 'GH-PR-102' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalRef?: string;
}
