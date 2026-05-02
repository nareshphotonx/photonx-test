import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class WfhActionDto {
  @ApiPropertyOptional({ example: 'Approved based on team capacity' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
