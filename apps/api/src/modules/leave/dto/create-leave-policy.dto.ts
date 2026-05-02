import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class LeaveUserOverrideDto {
  @ApiProperty({ example: 'cuid_user_1' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: 18 })
  @IsNumber()
  @Min(0)
  @Max(366)
  annualQuota!: number;

  @ApiPropertyOptional({ example: 1.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(31)
  monthlyAccrual?: number;
}

export class CreateLeavePolicyDto {
  @ApiProperty({ example: 'cuid_leave_type_1' })
  @IsString()
  @IsNotEmpty()
  leaveTypeId!: string;

  @ApiProperty({ example: 18 })
  @IsNumber()
  @Min(0)
  @Max(366)
  defaultAnnualQuota!: number;

  @ApiProperty({ example: 1.5 })
  @IsNumber()
  @Min(0)
  @Max(31)
  monthlyAccrual!: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  joiningProration?: boolean;

  @ApiPropertyOptional({ type: [LeaveUserOverrideDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeaveUserOverrideDto)
  userOverrides?: LeaveUserOverrideDto[];
}
