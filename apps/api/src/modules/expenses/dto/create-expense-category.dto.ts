import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min, Matches } from 'class-validator';

export class CreateExpenseCategoryDto {
  @ApiProperty({ example: 'TRAVEL' })
  @IsString()
  @Matches(/^[A-Z0-9_]{2,40}$/)
  code!: string;

  @ApiProperty({ example: 'Travel Expense' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Taxi, train, flight charges' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  capAmount?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
