import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class ManagerBulkTimeEntryItemDto {
  @ApiProperty({ example: 'cuid_user_2' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

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

  @ApiProperty({ example: 4.25, description: 'Must be in 0.25 increments' })
  @IsNumber()
  @Min(0.25)
  hours!: number;

  @ApiPropertyOptional({ example: 'Backfilled from sprint update' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ example: 'MGR-BULK-2026-05-02' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalRef?: string;
}

export class ManagerBulkTimeEntriesDto {
  @ApiProperty({ type: [ManagerBulkTimeEntryItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ManagerBulkTimeEntryItemDto)
  entries!: ManagerBulkTimeEntryItemDto[];
}
