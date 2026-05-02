import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateTeamDto {
  @ApiPropertyOptional({ example: 'Engineering Platform' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Platform and infra engineering team' })
  @IsOptional()
  @IsString()
  description?: string;
}
