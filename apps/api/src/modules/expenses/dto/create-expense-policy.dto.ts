import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateExpensePolicyDto {
  @ApiProperty({ example: 'cuid_expense_category_1' })
  @IsString()
  categoryId!: string;

  @ApiPropertyOptional({ example: 4000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  categoryCap?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  requireApproval?: boolean;
}
