import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDataExportRequestDto {
  @ApiPropertyOptional({
    example: 'Need a copy of my account data for compliance records',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @ApiPropertyOptional({
    example: 'json',
    default: 'json',
  })
  @IsOptional()
  @IsIn(['json'])
  format?: 'json';
}
