import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTaskCommentDto {
  @ApiProperty({ example: 'Need review from @teamlead before merge.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  content!: string;

  @ApiPropertyOptional({ example: ['cuid_user_2', 'cuid_user_3'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentionedUserIds?: string[];
}
