import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class CreateLeaveTypeDto {
  @ApiProperty({ example: 'CASUAL' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9_]{2,40}$/)
  code!: string;

  @ApiProperty({ example: 'Casual Leave' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'General-purpose leave' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
