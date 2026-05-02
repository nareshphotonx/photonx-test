import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class WfhUserOverrideDto {
  @ApiProperty({ example: 'cuid_user_1' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: 36 })
  @IsNumber()
  @Min(0)
  @Max(366)
  annualQuota!: number;
}

export class CreateWfhPolicyDto {
  @ApiProperty({ example: 36 })
  @IsNumber()
  @Min(0)
  @Max(366)
  defaultAnnualQuota!: number;

  @ApiPropertyOptional({ type: [WfhUserOverrideDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WfhUserOverrideDto)
  userOverrides?: WfhUserOverrideDto[];
}
