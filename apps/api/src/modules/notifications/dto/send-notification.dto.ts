import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationPriority, NotificationSource } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SendNotificationDto {
  @ApiProperty({ example: 'github-commit-confirmation-abc123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  eventKey!: string;

  @ApiProperty({ example: 'GITHUB_COMMIT_CONFIRMATION' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  eventType!: string;

  @ApiPropertyOptional({ example: 'Commit mapped to task T-101' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  title?: string;

  @ApiPropertyOptional({ example: 'Reply with 30m, 1h, 2h or custom time' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  body?: string;

  @ApiProperty({ type: [String], example: ['cuid_user_1'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  targetUserIds!: string[];

  @ApiProperty({ enum: NotificationChannel, isArray: true, example: [NotificationChannel.IN_APP] })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(NotificationChannel, { each: true })
  channels!: NotificationChannel[];

  @ApiProperty({
    type: Object,
    example: { taskKey: 'T-101', commitSha: 'abc123', options: ['30m', '1h', '2h', 'custom'] },
  })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({ enum: NotificationPriority, default: NotificationPriority.NORMAL })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ enum: NotificationSource, default: NotificationSource.SYSTEM })
  @IsOptional()
  @IsEnum(NotificationSource)
  source?: NotificationSource;
}
