import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ example: 'cuid_project_1' })
  @IsString()
  projectId!: string;

  @ApiProperty({ example: 'cuid_expense_category_1' })
  @IsString()
  categoryId!: string;

  @ApiProperty({ example: 2450 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ example: 'INR' })
  @IsString()
  @MaxLength(10)
  currency!: string;

  @ApiProperty({ example: '2026-07-14T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  expenseDate!: Date;

  @ApiProperty({ example: 'Client visit travel and meal' })
  @IsString()
  @MaxLength(1000)
  description!: string;

  @ApiPropertyOptional({ example: 'cuid_attachment_1' })
  @IsOptional()
  @IsString()
  receiptAttachmentId?: string;
}
