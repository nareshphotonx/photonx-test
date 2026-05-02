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

export class CreateUserDto {
  @ApiProperty({ example: 'John Employee' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'john@acme.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+919812345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'UserPass@123' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  isActive?: boolean;

  @ApiHideProperty()
  @Validate(EmailPhoneXorValidator)
  identifierRule!: string;
}
