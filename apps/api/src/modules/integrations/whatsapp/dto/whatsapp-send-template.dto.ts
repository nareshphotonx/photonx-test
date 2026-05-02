import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class WhatsappSendTemplateDto {
  @ApiProperty({ example: 'cuid_user_1' })
  @IsString()
  userId!: string;

  @ApiPropertyOptional({ example: 'utility_notification' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  templateName?: string;

  @ApiPropertyOptional({ type: [String], example: ['T-101', '30m'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  parameters?: string[];
}
