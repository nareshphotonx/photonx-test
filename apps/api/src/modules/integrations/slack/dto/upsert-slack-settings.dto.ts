import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertSlackSettingsDto {
  @ApiProperty({ example: 'https://hooks.slack.com/services/T000/B000/XXX' })
  @IsString()
  @MaxLength(500)
  webhookUrl!: string;

  @ApiPropertyOptional({ example: '#ops-alerts' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultChannel?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;
}
