import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AiChatDto {
  @ApiProperty({
    example: 'What is my leave balance this year?',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  prompt!: string;

  @ApiPropertyOptional({
    example: 'cuid_ai_conversation_1',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;
}
