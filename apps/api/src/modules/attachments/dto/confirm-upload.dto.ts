import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsString, Max, MaxLength } from 'class-validator';

export class ConfirmUploadDto {
  @ApiProperty({ example: 'cuid_task_1' })
  @IsString()
  @IsNotEmpty()
  taskId!: string;

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
