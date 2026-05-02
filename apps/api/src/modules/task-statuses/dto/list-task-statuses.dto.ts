import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ListTaskStatusesDto {
  @ApiProperty({ example: 'cuid_project_1' })
  @IsString()
  @IsNotEmpty()
  projectId!: string;
}
