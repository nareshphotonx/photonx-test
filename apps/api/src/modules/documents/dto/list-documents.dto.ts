import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListDocumentsDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'POLICY' })
  @IsOptional()
  @IsString()
  documentType?: string;
}
