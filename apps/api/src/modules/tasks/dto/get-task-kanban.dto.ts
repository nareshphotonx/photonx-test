import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetTaskKanbanDto {
  @ApiProperty({ example: 'cuid_project_1' })
  @IsString()
  @IsNotEmpty()
  projectId!: string;
}
