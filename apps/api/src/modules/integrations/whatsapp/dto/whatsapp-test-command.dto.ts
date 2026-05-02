import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class WhatsappTestCommandDto {
  @ApiProperty({ example: 'photonx-default' })
  @IsString()
  @MaxLength(191)
  tenantSlug!: string;

  @ApiProperty({ example: 'check in' })
  @IsString()
  @MaxLength(1000)
  command!: string;

  @ApiPropertyOptional({ example: '+919999999999' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  userPhone?: string;
}
