import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class MapUnmatchedCommitDto {
  @ApiProperty({ example: 'T-101' })
  @IsString()
  @MaxLength(50)
  taskKey!: string;
}
