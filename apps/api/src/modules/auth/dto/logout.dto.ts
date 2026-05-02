import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LogoutDto {
  @ApiProperty({ example: 'refresh-token-value' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
