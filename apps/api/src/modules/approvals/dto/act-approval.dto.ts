import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ActApprovalDto {
  @ApiPropertyOptional({ example: 'Validated and approved' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
