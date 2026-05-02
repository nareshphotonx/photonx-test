import { Injectable } from '@nestjs/common';

@Injectable()
export class DocumentChunkingService {
  chunk(content: string, chunkSize: number, overlap: number): string[] {
    const normalized = content.replace(/\r\n/g, '\n').trim();
    if (!normalized) {
      return [];
    }

    const chunks: string[] = [];
    let cursor = 0;

    while (cursor < normalized.length) {
      const end = Math.min(cursor + chunkSize, normalized.length);
      const rawChunk = normalized.slice(cursor, end);
      chunks.push(rawChunk.trim());

      if (end >= normalized.length) {
        break;
      }

      cursor = Math.max(end - overlap, cursor + 1);
    }

    return chunks.filter((entry) => entry.length > 0);
  }
}
