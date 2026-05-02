import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RegularizationActionDto {
  @ApiPropertyOptional({ example: 'Approved after verification' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
