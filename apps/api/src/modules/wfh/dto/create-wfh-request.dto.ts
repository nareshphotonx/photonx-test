import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsString, MaxLength } from 'class-validator';

export class CreateWfhRequestDto {
  @ApiProperty({ example: '2026-07-12T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  requestDate!: Date;

  @ApiProperty({ example: 'Need to work remotely due to commute disruption' })
  @IsString()
  @MaxLength(1000)
  reason!: string;
}
