import { ApiProperty } from '@nestjs/swagger';
import { ProjectMemberRole } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ProjectMemberInputDto {
  @ApiProperty({ example: 'cuid_user_1' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ enum: ProjectMemberRole, default: ProjectMemberRole.CONTRIBUTOR })
  @IsEnum(ProjectMemberRole)
  role!: ProjectMemberRole;
}

export class AddProjectMembersDto {
  @ApiProperty({
    type: [ProjectMemberInputDto],
    example: [
      { userId: 'cuid_user_1', role: ProjectMemberRole.MANAGER },
      { userId: 'cuid_user_2', role: ProjectMemberRole.CONTRIBUTOR },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProjectMemberInputDto)
  members!: ProjectMemberInputDto[];
}
