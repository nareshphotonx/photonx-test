import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpsertGithubSettingsDto {
  @ApiProperty({ example: 'github-webhook-secret' })
  @IsString()
  @MaxLength(300)
  webhookSecret!: string;

  @ApiPropertyOptional({ example: 'T-\\d+' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  taskKeyRegex?: string;

  @ApiPropertyOptional({ type: [String], example: ['dependabot[bot]', 'github-actions[bot]'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  botUsernames?: string[];

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;
}
