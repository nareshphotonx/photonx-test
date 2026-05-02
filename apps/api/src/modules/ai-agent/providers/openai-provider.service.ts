import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import {
  type AiAnswerResult,
  type AiPlanResult,
  type AiProvider,
  type AiProviderToolDefinition,
} from './ai-provider.interface';

@Injectable()
export class OpenAiProviderService implements AiProvider {
  private readonly apiKey?: string;
  private readonly chatModel: string;
  private readonly embedModel: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.chatModel = this.configService.get<string>('OPENAI_CHAT_MODEL', 'gpt-4.1-mini');
    this.embedModel = this.configService.get<string>('OPENAI_EMBED_MODEL', 'text-embedding-3-small');
  }

  async generatePlan(input: {
    prompt: string;
    tools: AiProviderToolDefinition[];
  }): Promise<AiPlanResult> {
    if (!this.apiKey) {
      return this.fallbackPlan(input.prompt, input.tools);
    }

    const system = [
      'You are a strict backend planner.',
      'Always respond with JSON only.',
      'Never propose SQL or database direct access. Use only provided tools.',
      'Set requiresRag true only for policy/SOP/document questions.',
    ].join(' ');

    const user = JSON.stringify({
      prompt: input.prompt,
      tools: input.tools,
      schema: {
        intent: 'string',
        confidence: 'number 0..1',
        requiresRag: 'boolean',
        ragQuery: 'string optional',
        directAnswer: 'string optional',
        toolCalls: [{ toolName: 'string', input: 'object' }],
      },
    });

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.chatModel,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: `${system} JSON.` },
            { role: 'user', content: user },
          ],
        }),
      });

      const payload = (await response.json()) as any;
      const content = payload?.choices?.[0]?.message?.content;

      if (!response.ok || typeof content !== 'string') {
        return this.fallbackPlan(input.prompt, input.tools);
      }

      const parsed = JSON.parse(content) as Partial<AiPlanResult>;
      return {
        intent: typeof parsed.intent === 'string' ? parsed.intent : 'GENERAL',
        confidence:
          typeof parsed.confidence === 'number'
            ? Math.max(0, Math.min(1, parsed.confidence))
            : 0.7,
        requiresRag: Boolean(parsed.requiresRag),
        ragQuery: typeof parsed.ragQuery === 'string' ? parsed.ragQuery : undefined,
        directAnswer:
          typeof parsed.directAnswer === 'string' ? parsed.directAnswer : undefined,
        toolCalls: Array.isArray(parsed.toolCalls)
          ? parsed.toolCalls
              .filter((entry) =>
                entry &&
                typeof (entry as any).toolName === 'string' &&
                typeof (entry as any).input === 'object',
              )
              .map((entry) => ({
                toolName: (entry as any).toolName,
                input: (entry as any).input as Record<string, unknown>,
              }))
          : [],
      };
    } catch {
      return this.fallbackPlan(input.prompt, input.tools);
    }
  }

  async generateAnswer(input: {
    prompt: string;
    intent: string;
    toolResults: Array<Record<string, unknown>>;
    ragSources: Array<Record<string, unknown>>;
    directAnswer?: string;
  }): Promise<AiAnswerResult> {
    if (!this.apiKey) {
      return this.fallbackAnswer(input);
    }

    const system = [
      'You are a tenant-safe enterprise assistant.',
      'Always respond with JSON only.',
      'Use only provided tool results and RAG snippets.',
      'If uncertain, lower confidence.',
    ].join(' ');

    const user = JSON.stringify({
      prompt: input.prompt,
      intent: input.intent,
      directAnswer: input.directAnswer,
      toolResults: input.toolResults,
      ragSources: input.ragSources,
      schema: {
        answer: 'string',
        confidence: 'number 0..1',
        sources: [{ source: 'string', reference: 'string optional' }],
      },
    });

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.chatModel,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: `${system} JSON.` },
            { role: 'user', content: user },
          ],
        }),
      });

      const payload = (await response.json()) as any;
      const content = payload?.choices?.[0]?.message?.content;

      if (!response.ok || typeof content !== 'string') {
        return this.fallbackAnswer(input);
      }

      const parsed = JSON.parse(content) as Partial<AiAnswerResult>;
      return {
        answer:
          typeof parsed.answer === 'string'
            ? parsed.answer
            : "I don't know based on available data.",
        confidence:
          typeof parsed.confidence === 'number'
            ? Math.max(0, Math.min(1, parsed.confidence))
            : 0.7,
        sources: Array.isArray(parsed.sources)
          ? parsed.sources.filter((entry) => typeof entry === 'object' && entry !== null)
          : [],
      };
    } catch {
      return this.fallbackAnswer(input);
    }
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      return texts.map((entry) => this.fallbackEmbedding(entry));
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.embedModel,
          input: texts,
        }),
      });

      const payload = (await response.json()) as any;
      if (!response.ok || !Array.isArray(payload?.data)) {
        return texts.map((entry) => this.fallbackEmbedding(entry));
      }

      return payload.data.map((row: any) =>
        Array.isArray(row.embedding) ? row.embedding.map((v: unknown) => Number(v)) : [],
      );
    } catch {
      return texts.map((entry) => this.fallbackEmbedding(entry));
    }
  }

  private fallbackPlan(
    prompt: string,
    tools: AiProviderToolDefinition[],
  ): AiPlanResult {
    const text = prompt.toLowerCase();
    const has = (name: string) => tools.some((entry) => entry.name === name);

    if (/leave\s+balance/.test(text) && has('get_user_leave_balance')) {
      return {
        intent: 'LEAVE_BALANCE',
        confidence: 0.85,
        requiresRag: false,
        toolCalls: [{ toolName: 'get_user_leave_balance', input: {} }],
      };
    }

    if (/my\s+tasks|list\s+tasks/.test(text) && has('list_my_tasks')) {
      return {
        intent: 'LIST_TASKS',
        confidence: 0.8,
        requiresRag: false,
        toolCalls: [{ toolName: 'list_my_tasks', input: {} }],
      };
    }

    if (/project\s+burn/.test(text) && has('get_project_burn')) {
      return {
        intent: 'PROJECT_BURN',
        confidence: 0.75,
        requiresRag: false,
        toolCalls: [],
      };
    }

    if (/policy|sop|handbook|document/.test(text)) {
      return {
        intent: 'DOCUMENT_RAG',
        confidence: 0.72,
        requiresRag: true,
        ragQuery: prompt,
        toolCalls: [],
      };
    }

    return {
      intent: 'GENERAL',
      confidence: 0.6,
      requiresRag: false,
      toolCalls: [],
      directAnswer: "I don't know based on available data.",
    };
  }

  private fallbackAnswer(input: {
    prompt: string;
    intent: string;
    toolResults: Array<Record<string, unknown>>;
    ragSources: Array<Record<string, unknown>>;
    directAnswer?: string;
  }): AiAnswerResult {
    if (input.directAnswer) {
      return {
        answer: input.directAnswer,
        confidence: 0.6,
        sources: [],
      };
    }

    if (input.toolResults.length > 0) {
      return {
        answer: JSON.stringify(input.toolResults[0]),
        confidence: 0.8,
        sources: [{ source: 'tool', reference: input.intent }],
      };
    }

    if (input.ragSources.length > 0) {
      return {
        answer: String(input.ragSources[0]?.snippet ?? "I don't know based on available data."),
        confidence: 0.7,
        sources: input.ragSources,
      };
    }

    return {
      answer: "I don't know based on available data.",
      confidence: 0.55,
      sources: [],
    };
  }

  private fallbackEmbedding(input: string): number[] {
    const digest = createHash('sha256').update(input).digest();
    const dimensions = 64;
    const output: number[] = [];

    for (let i = 0; i < dimensions; i += 1) {
      const byte = digest[i % digest.length] ?? 0;
      output.push((byte / 255) * 2 - 1);
    }

    return output;
  }
}
