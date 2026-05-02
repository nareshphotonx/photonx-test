import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateHolidayDto {
  @ApiProperty({ example: 'Founders Day' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: '2026-08-15T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  date!: Date;

  @ApiPropertyOptional({ example: 'cuid_location_1' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
