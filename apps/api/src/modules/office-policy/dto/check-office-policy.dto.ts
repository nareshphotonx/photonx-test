import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CheckOfficePolicyDto {
  @ApiPropertyOptional({
    description: 'Optional override IP for admin/testing checks',
    example: '203.0.113.9',
  })
  @IsOptional()
  @IsString()
  ip?: string;
}
