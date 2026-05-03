import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { SearchDocumentsDto } from './dto/search-documents.dto';
import { DocumentsService } from './documents.service';

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.DOCUMENTS_CREATE)
  @ApiOperation({ summary: 'Create tenant policy/SOP document and chunks' })
  @ApiBody({ type: CreateDocumentDto })
  @ApiCreatedResponse({ description: 'Document created and chunked' })
  createDocument(@CurrentUser() user: Express.User, @Body() dto: CreateDocumentDto) {
    return this.documentsService.createDocument(user.tenantId, user, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.DOCUMENTS_READ)
  @ApiOperation({ summary: 'List tenant documents' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false, example: 'policy' })
  @ApiQuery({ name: 'documentType', required: false, example: 'POLICY' })
  @ApiQuery({ name: 'includeDeleted', required: false, example: false })
  @ApiOkResponse({ description: 'Document list' })
  listDocuments(@CurrentUser() user: Express.User, @Query() query: ListDocumentsDto) {
    return this.documentsService.listDocuments(user.tenantId, query);
  }

  @Post('search')
  @RequirePermissions(PERMISSIONS.DOCUMENTS_SEARCH)
  @ApiOperation({ summary: 'Search document chunks for RAG' })
  @ApiBody({
    type: SearchDocumentsDto,
    examples: {
      policy: {
        value: {
          query: 'How many optional holidays can be claimed?',
          topK: 5,
          documentType: 'POLICY',
          tags: ['leave'],
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Ranked document chunk hits' })
  searchDocuments(@CurrentUser() user: Express.User, @Body() dto: SearchDocumentsDto) {
    return this.documentsService.searchDocuments(user.tenantId, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DOCUMENTS_DELETE)
  @ApiOperation({ summary: 'Soft delete tenant document and invalidate AI cache' })
  @ApiParam({ name: 'id', example: 'cuid_document_1' })
  @ApiOkResponse({ description: 'Document deleted' })
  deleteDocument(@CurrentUser() user: Express.User, @Param('id') id: string) {
    return this.documentsService.deleteDocument(user.tenantId, user, id);
  }
}
