import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListAiMessagesDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'cuid_ai_conversation_1' })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({
    example: 'cuid_user_1',
    description:
      'Optional tenant-wide filter; only available to TEAM_LEAD/SUPER_ADMIN',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ example: 'COMPLETED' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) =>
    value === true || value === 'true'
      ? true
      : value === false || value === 'false'
        ? false
        : value,
  )
  onlyAssistant?: boolean;
}
