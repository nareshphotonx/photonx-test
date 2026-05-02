import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertEmailSettingsDto {
  @ApiProperty({ example: 'smtp.gmail.com' })
  @IsString()
  @MaxLength(191)
  smtpHost!: string;

  @ApiPropertyOptional({ example: 587, default: 587 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  secure?: boolean;

  @ApiProperty({ example: 'alerts@photonx.com' })
  @IsEmail()
  fromEmail!: string;

  @ApiProperty({ example: 'smtp-user' })
  @IsString()
  @MaxLength(191)
  smtpUser!: string;

  @ApiProperty({ example: 'smtp-password' })
  @IsString()
  @MaxLength(300)
  smtpPassword!: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;
}
