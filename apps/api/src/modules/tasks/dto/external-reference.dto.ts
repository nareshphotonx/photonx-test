import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class ExternalReferenceDto {
  @ApiProperty({ example: 'jira' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  source!: string;

  @ApiProperty({ example: 'PROJ-1021' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  referenceId!: string;

  @ApiPropertyOptional({ example: 'https://jira.example.com/browse/PROJ-1021' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @ApiPropertyOptional({ example: { sprint: 'Sprint-10', board: 'Core' } })
  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
