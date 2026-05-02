import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRegularizationDto {
  @ApiProperty({ example: '2026-06-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  date!: Date;

  @ApiProperty({ example: '2026-06-01T09:40:00.000Z' })
  @Type(() => Date)
  @IsDate()
  correctedCheckInAt!: Date;

  @ApiProperty({ example: '2026-06-01T18:20:00.000Z' })
  @Type(() => Date)
  @IsDate()
  correctedCheckOutAt!: Date;

  @ApiProperty({ example: 'Forgot to checkout from mobile app' })
  @IsString()
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({ example: 'cuid_attendance_day_1' })
  @IsOptional()
  @IsString()
  attendanceDayId?: string;
}
