import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { SearchDocumentsDto } from './dto/search-documents.dto';

@Injectable()
export class DocumentSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async search(
    tenantId: string,
    query: SearchDocumentsDto,
  ): Promise<{
    items: Array<Record<string, unknown>>;
  }> {
    const topK = query.topK ?? 5;
    const [queryVector] = await this.embeddingService.embed([query.query]);

    const preCandidateIds = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT dc.id
        FROM DocumentChunk dc
        INNER JOIN Document d ON d.id = dc.documentId
        WHERE dc.tenantId = ${tenantId}
          AND d.deletedAt IS NULL
          ${
            query.documentType
              ? Prisma.sql`AND d.documentType = ${query.documentType}`
              : Prisma.empty
          }
          AND MATCH(dc.content) AGAINST (${query.query} IN NATURAL LANGUAGE MODE)
        ORDER BY dc.createdAt DESC
        LIMIT 100
      `,
    );

    const preCandidates =
      preCandidateIds.length > 0
        ? await this.prisma.documentChunk.findMany({
            where: {
              id: { in: preCandidateIds.map((entry) => entry.id) },
            },
            include: {
              document: {
                select: {
                  id: true,
                  title: true,
                  documentType: true,
                  tags: true,
                },
              },
            },
            take: 100,
            orderBy: { createdAt: 'desc' },
          })
        : await this.prisma.documentChunk.findMany({
            where: {
              tenantId,
              content: { contains: query.query },
              document: {
                deletedAt: null,
                ...(query.documentType ? { documentType: query.documentType as any } : {}),
              },
            },
            include: {
              document: {
                select: {
                  id: true,
                  title: true,
                  documentType: true,
                  tags: true,
                },
              },
            },
            take: 100,
            orderBy: { createdAt: 'desc' },
          });

    const tagFilteredCandidates =
      query.tags && query.tags.length > 0
        ? preCandidates.filter((entry) => {
            if (!Array.isArray(entry.document.tags)) {
              return false;
            }

            const tagSet = new Set(
              entry.document.tags
                .filter((value): value is string => typeof value === 'string')
                .map((value) => value.toLowerCase()),
            );
            return query.tags?.some((tag) => tagSet.has(tag.toLowerCase())) ?? false;
          })
        : preCandidates;

    const scored = tagFilteredCandidates
      .map((entry) => {
        const embedding = Array.isArray(entry.embedding)
          ? entry.embedding.map((v) => Number(v))
          : [];
        const score = this.cosineSimilarity(queryVector ?? [], embedding);

        return {
          id: entry.id,
          documentId: entry.documentId,
          documentTitle: entry.document.title,
          documentType: entry.document.documentType,
          tags: entry.document.tags,
          chunkIndex: entry.chunkIndex,
          snippet: entry.content.slice(0, 500),
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return {
      items: scored,
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) {
      return 0;
    }

    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < a.length; i += 1) {
      const va = a[i] ?? 0;
      const vb = b[i] ?? 0;

      dot += va * vb;
      magA += va * va;
      magB += vb * vb;
    }

    if (magA === 0 || magB === 0) {
      return 0;
    }

    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }
}
