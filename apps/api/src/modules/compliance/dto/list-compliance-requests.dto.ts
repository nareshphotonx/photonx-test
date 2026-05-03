import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ComplianceRequestStatus,
  ComplianceRequestType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListComplianceRequestsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ComplianceRequestType })
  @IsOptional()
  @IsEnum(ComplianceRequestType)
  type?: ComplianceRequestType;

  @ApiPropertyOptional({ enum: ComplianceRequestStatus })
  @IsOptional()
  @IsEnum(ComplianceRequestStatus)
  status?: ComplianceRequestStatus;

  @ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ example: '2026-05-31T23:59:59.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiPropertyOptional({
    example: 'cuid_user_1',
    description: 'SUPER_ADMIN-only optional filter',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
