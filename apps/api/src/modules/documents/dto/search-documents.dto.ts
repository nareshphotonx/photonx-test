import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchDocumentsDto {
  @ApiProperty({ example: 'How many optional holidays can be claimed?' })
  @IsString()
  query!: string;

  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;

  @ApiPropertyOptional({ example: 'POLICY' })
  @IsOptional()
  @IsString()
  documentType?: string;

  @ApiPropertyOptional({ type: [String], example: ['leave'] })
  @IsOptional()
  @Type(() => String)
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
