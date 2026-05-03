import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class CreateDataErasureRequestDto {
  @ApiProperty({
    example: 'I want my personal data erased from the system',
  })
  @IsString()
  @MaxLength(1000)
  reason!: string;

  @ApiProperty({
    example: true,
    description: 'Must be true to confirm irreversible data anonymization request',
  })
  @IsBoolean()
  confirm!: boolean;
}
