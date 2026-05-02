import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export enum DocumentTypeDto {
  POLICY = 'POLICY',
  SOP = 'SOP',
  GENERAL = 'GENERAL',
}

export class CreateDocumentDto {
  @ApiProperty({ example: 'Leave Policy 2026' })
  @IsString()
  @MaxLength(191)
  title!: string;

  @ApiProperty({ enum: DocumentTypeDto, example: DocumentTypeDto.POLICY })
  @IsEnum(DocumentTypeDto)
  documentType!: DocumentTypeDto;

  @ApiPropertyOptional({ type: [String], example: ['leave', 'hr-policy'] })
  @IsOptional()
  @Type(() => String)
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ example: 'Employees can apply for casual leave up to 2 days ...' })
  @IsString()
  @MinLength(20)
  content!: string;
}
