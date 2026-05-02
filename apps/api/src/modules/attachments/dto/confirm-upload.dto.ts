import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttachmentEntityType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';

export class ConfirmUploadDto {
  @ApiPropertyOptional({ enum: AttachmentEntityType, default: AttachmentEntityType.TASK })
  @IsOptional()
  @IsEnum(AttachmentEntityType)
  entityType?: AttachmentEntityType;

  @ApiPropertyOptional({ example: 'cuid_task_1' })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ example: 'cuid_task_1' })
  @IsOptional()
  @IsString()
  taskId?: string;

  @ApiPropertyOptional({ example: 'cuid_project_1' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiProperty({ example: 'tenantId/taskId/1714639300-evidence-selfie.jpg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  s3Key!: string;

  @ApiProperty({ example: 'evidence-selfie.jpg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fileName!: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  contentType!: string;

  @ApiProperty({ example: 123456 })
  @IsInt()
  @IsPositive()
  @Max(20 * 1024 * 1024)
  sizeBytes!: number;
}
