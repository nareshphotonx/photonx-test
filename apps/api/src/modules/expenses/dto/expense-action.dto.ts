import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ExpenseActionDto {
  @ApiPropertyOptional({ example: 'Approved as per policy' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
