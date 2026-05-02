import { Injectable } from '@nestjs/common';
import { OpenAiProviderService } from '../ai-agent/providers/openai-provider.service';

@Injectable()
export class EmbeddingService {
  constructor(private readonly provider: OpenAiProviderService) {}

  async embed(texts: string[]): Promise<number[][]> {
    return this.provider.embedTexts(texts);
  }
}
