import { Module } from '@nestjs/common';
import { AiCacheService } from '../ai-agent/ai-cache.service';
import { OpenAiProviderService } from '../ai-agent/providers/openai-provider.service';
import { DocumentsController } from './documents.controller';
import { DocumentChunkingService } from './document-chunking.service';
import { DocumentSearchService } from './document-search.service';
import { DocumentsService } from './documents.service';
import { EmbeddingService } from './embedding.service';

@Module({
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentChunkingService,
    DocumentSearchService,
    EmbeddingService,
    OpenAiProviderService,
    AiCacheService,
  ],
  exports: [DocumentsService, DocumentSearchService],
})
export class DocumentsModule {}
