import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOfficeIpDto {
  @ApiProperty({ example: '203.0.113.0/24' })
  @IsString()
  @IsNotEmpty()
  cidr!: string;

  @ApiPropertyOptional({ example: 'Main office broadband' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
