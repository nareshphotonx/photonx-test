import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AiCacheService } from '../ai-agent/ai-cache.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { SearchDocumentsDto } from './dto/search-documents.dto';
import { DocumentChunkingService } from './document-chunking.service';
import { DocumentSearchService } from './document-search.service';
import { EmbeddingService } from './embedding.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly chunkingService: DocumentChunkingService,
    private readonly embeddingService: EmbeddingService,
    private readonly searchService: DocumentSearchService,
    private readonly aiCacheService: AiCacheService,
  ) {}

  async createDocument(tenantId: string, actor: Express.User, dto: CreateDocumentDto) {
    this.assertCanManage(actor);

    const chunkSize = Number(process.env.AI_CHUNK_SIZE ?? '1200');
    const chunkOverlap = Number(process.env.AI_CHUNK_OVERLAP ?? '200');
    if (chunkOverlap >= chunkSize) {
      throw new BadRequestException('AI_CHUNK_OVERLAP must be less than AI_CHUNK_SIZE');
    }

    const chunks = this.chunkingService.chunk(dto.content, chunkSize, chunkOverlap);
    const vectors = await this.embeddingService.embed(chunks);

    const created = await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          tenantId,
          createdById: actor.sub,
          title: dto.title,
          documentType: dto.documentType,
          tags: (dto.tags ?? []) as Prisma.InputJsonValue,
          content: dto.content,
        },
      });

      for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i] ?? '';
        const vector = vectors[i] ?? [];

        await tx.documentChunk.create({
          data: {
            tenantId,
            documentId: document.id,
            chunkIndex: i,
            content: chunk,
            tokenCount: this.estimateTokens(chunk),
            embedding: vector as unknown as Prisma.InputJsonValue,
            contentHash: createHash('sha256').update(chunk).digest('hex'),
          },
        });
      }

      return document;
    });

    await this.aiCacheService.invalidateTenant(tenantId);

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'DOCUMENT_CREATE',
      entityType: 'Document',
      entityId: created.id,
      metadata: {
        title: dto.title,
        documentType: dto.documentType,
        chunkCount: chunks.length,
      },
    });

    return {
      id: created.id,
      title: created.title,
      documentType: created.documentType,
      chunkCount: chunks.length,
      createdAt: created.createdAt,
    };
  }

  async listDocuments(tenantId: string, query: ListDocumentsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.DocumentWhereInput = {
      tenantId,
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search } },
              { content: { contains: query.search } },
            ],
          }
        : {}),
      ...(query.documentType ? { documentType: query.documentType as any } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({
        where,
        include: {
          _count: {
            select: {
              chunks: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: items.map((entry) => ({
        id: entry.id,
        title: entry.title,
        documentType: entry.documentType,
        tags: entry.tags,
        chunkCount: entry._count.chunks,
        createdAt: entry.createdAt,
        deletedAt: entry.deletedAt,
      })),
      page,
      limit,
      total,
    };
  }

  async searchDocuments(tenantId: string, query: SearchDocumentsDto) {
    return this.searchService.search(tenantId, query);
  }

  async deleteDocument(tenantId: string, actor: Express.User, documentId: string) {
    this.assertCanManage(actor);

    const existing = await this.prisma.document.findFirst({
      where: {
        tenantId,
        id: documentId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Document not found');
    }

    await this.prisma.document.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
      },
    });

    await this.aiCacheService.invalidateTenant(tenantId);

    await this.auditService.log({
      tenantId,
      actorId: actor.sub,
      action: 'DOCUMENT_DELETE',
      entityType: 'Document',
      entityId: existing.id,
    });

    return { deleted: true };
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private assertCanManage(actor: Express.User): void {
    const roles = actor.roles ?? [];
    if (roles.includes(Role.SUPER_ADMIN) || roles.includes(Role.TEAM_LEAD)) {
      return;
    }

    throw new ForbiddenException('Only TEAM_LEAD or SUPER_ADMIN can manage documents');
  }
}
