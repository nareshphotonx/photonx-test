import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EmailPhoneXorValidator } from '../../../common/validators/email-phone-xor.validator';

export class ImportUserItemDto {
  @ApiProperty({ example: 'Imported User' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'imported@acme.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+919911223344' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'ImportPass@123' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiHideProperty()
  @Validate(EmailPhoneXorValidator)
  identifierRule!: string;
}

export class ImportUsersDto {
  @ApiProperty({ type: [ImportUserItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportUserItemDto)
  users!: ImportUserItemDto[];
}
