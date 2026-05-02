import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { WorkWeekStart } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  Validate,
} from 'class-validator';
import { EmailPhoneXorValidator } from '../../../common/validators/email-phone-xor.validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme India Pvt Ltd' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'acme-india' })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @ApiProperty({ example: 'Owner Admin' })
  @IsString()
  @IsNotEmpty()
  ownerName!: string;

  @ApiPropertyOptional({ example: 'owner@acme.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+919999999999' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'OwnerPass@123' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: WorkWeekStart, example: WorkWeekStart.MONDAY })
  @IsOptional()
  @IsEnum(WorkWeekStart)
  workWeekStart?: WorkWeekStart;

  @ApiPropertyOptional({
    example: {
      attendanceWindowStart: '09:00',
      attendanceWindowEnd: '10:30',
    },
  })
  @IsOptional()
  @IsObject()
  extras?: Record<string, unknown>;

  @ApiHideProperty()
  @Validate(EmailPhoneXorValidator)
  identifierRule!: string;
}
