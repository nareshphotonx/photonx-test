import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Validate,
} from 'class-validator';
import { EmailPhoneXorValidator } from '../../../common/validators/email-phone-xor.validator';

export class LoginDto {
  @ApiProperty({ example: 'acme-india' })
  @IsString()
  @IsNotEmpty()
  tenantSlug!: string;

  @ApiPropertyOptional({ example: 'lead@acme.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+919999999999' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'StrongPass@123' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiHideProperty()
  @Validate(EmailPhoneXorValidator)
  identifierRule!: string;
}
