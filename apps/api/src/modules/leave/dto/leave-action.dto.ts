import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LeaveActionDto {
  @ApiPropertyOptional({ example: 'Approved for planned leave window' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
