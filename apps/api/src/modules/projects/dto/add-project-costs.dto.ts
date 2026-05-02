import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class ProjectCostLineDto {
  @ApiProperty({ example: 4500.75 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  currency!: string;

  @ApiProperty({ example: 'cloud-infra' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  category!: string;

  @ApiProperty({ example: '2026-05-02T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  costDate!: Date;

  @ApiProperty({ required: false, example: 'AWS monthly invoice' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class AddProjectCostsDto {
  @ApiProperty({
    type: [ProjectCostLineDto],
    example: [
      {
        amount: 4500.75,
        currency: 'USD',
        category: 'cloud-infra',
        costDate: '2026-05-02T00:00:00.000Z',
        note: 'AWS monthly invoice',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProjectCostLineDto)
  items!: ProjectCostLineDto[];
}
