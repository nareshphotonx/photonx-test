import { ApiPropertyOptional } from '@nestjs/swagger';
import { WorkWeekStart } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateTenantSettingsDto {
  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: WorkWeekStart, example: WorkWeekStart.MONDAY })
  @IsOptional()
  @IsEnum(WorkWeekStart)
  workWeekStart?: WorkWeekStart;

  @ApiPropertyOptional({ example: { lateMarkMinutes: 10 } })
  @IsOptional()
  @IsObject()
  extras?: Record<string, unknown>;
}
