import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdjustTimeEntryDto {
  @ApiProperty({
    example: -1.25,
    description: 'Positive or negative, must be in 0.25 increments',
  })
  @IsNumber()
  hoursDelta!: number;

  @ApiProperty({ example: 'Correction for over-logged work' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ example: 'Adjustment approved by manager' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
