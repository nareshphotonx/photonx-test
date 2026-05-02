import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DependencyType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTaskDependencyDto {
  @ApiProperty({ example: 'cuid_task_dependency_target_1' })
  @IsString()
  @IsNotEmpty()
  dependsOnTaskId!: string;

  @ApiPropertyOptional({
    enum: DependencyType,
    default: DependencyType.FINISH_TO_START,
  })
  @IsOptional()
  @IsEnum(DependencyType)
  type?: DependencyType;
}
