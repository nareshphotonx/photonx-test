import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ChangeTaskStatusDto {
  @ApiProperty({ example: 'cuid_status_done' })
  @IsString()
  @IsNotEmpty()
  statusId!: string;

  @ApiPropertyOptional({ example: 12.9701 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  locationLatitude?: number;

  @ApiPropertyOptional({ example: 77.5937 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  locationLongitude?: number;

  @ApiPropertyOptional({ example: 'cuid_attachment_1' })
  @IsOptional()
  @IsString()
  selfieAttachmentId?: string;
}
