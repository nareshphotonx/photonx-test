import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type AiMessageStatus } from '@prisma/client';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentSearchService } from '../documents/document-search.service';
import { SearchDocumentsDto } from '../documents/dto/search-documents.dto';
import { AiCacheService } from './ai-cache.service';
import { AiPromptDefenseService } from './ai-prompt-defense.service';
import { AiToolExecutorService, type ExecutedToolCall } from './ai-tool-executor.service';
import { AiToolRegistryService } from './ai-tool-registry.service';
import { ListAiMessagesDto } from './dto/list-ai-messages.dto';
import { OpenAiProviderService } from './providers/openai-provider.service';

interface ChatCachePayload {
  conversationId: string;
  answer: string;
  confidence: number;
  intent: string;
  toolCalls: ExecutedToolCall[];
  sources: Array<Record<string, unknown>>;
}

@Injectable()
export class AiAgentService {
  private readonly confidenceThreshold: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly promptDefenseService: AiPromptDefenseService,
    private readonly cacheService: AiCacheService,
    private readonly toolRegistryService: AiToolRegistryService,
    private readonly toolExecutorService: AiToolExecutorService,
    private readonly providerService: OpenAiProviderService,
    private readonly documentSearchService: DocumentSearchService,
  ) {
    this.confidenceThreshold = Number(
      this.configService.get<string>('AI_CONFIDENCE_THRESHOLD', '0.65'),
    );
  }

  async chat(
    tenantId: string,
    actor: Express.User,
    input: { prompt: string; conversationId?: string },
  ) {
    const permissions = actor.permissions ?? [];
    if (!permissions.includes(PERMISSIONS.AI_CHAT)) {
      throw new ForbiddenException('Permission ai:chat is required');
    }

    const defense = this.promptDefenseService.sanitize(input.prompt);
    const conversation = await this.resolveConversation(
      tenantId,
      actor.sub,
      input.conversationId,
      defense.normalizedPrompt,
    );

    const cacheKey = this.cacheService.buildCacheKey({
      tenantId,
      userId: actor.sub,
      conversationId: conversation.id,
      prompt: defense.normalizedPrompt,
    });

    await this.prisma.aiMessage.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        userId: actor.sub,
        role: 'USER',
        prompt: defense.normalizedPrompt,
        status: defense.blocked ? 'BLOCKED' : 'COMPLETED',
      },
    });

    const cached = await this.cacheService.get<ChatCachePayload>(cacheKey);

    if (cached) {
      const message = await this.persistAssistantMessage({
        tenantId,
        actor,
        conversationId: cached.conversationId,
        prompt: defense.normalizedPrompt,
        intent: cached.intent,
        answer: cached.answer,
        confidence: cached.confidence,
        status:
          cached.confidence >= this.confidenceThreshold ? 'COMPLETED' : 'FALLBACK',
        sources: cached.sources,
        toolCalls: cached.toolCalls,
        cacheKey,
        cacheHit: true,
        promptInjectionMeta: {
          blocked: defense.blocked,
          flags: defense.flags,
          reason: defense.reason,
          cache: true,
        },
      });

      return {
        conversationId: cached.conversationId,
        messageId: message.id,
        answer: cached.answer,
        confidence: cached.confidence,
        intent: cached.intent,
        toolCalls: cached.toolCalls,
        sources: cached.sources,
        cacheHit: true,
      };
    }

    const tools = this.toolRegistryService.listTools();
    const plan = defense.blocked
      ? {
          intent: 'PROMPT_INJECTION_BLOCKED',
          confidence: 0.3,
          requiresRag: false,
          toolCalls: [],
          directAnswer: "I don't know based on available data.",
        }
      : await this.providerService.generatePlan({
          prompt: defense.normalizedPrompt,
          tools,
        });

    const executedToolCalls: ExecutedToolCall[] = [];
    for (const call of plan.toolCalls) {
      if (!this.toolRegistryService.hasTool(call.toolName)) {
        executedToolCalls.push({
          toolName: call.toolName,
          input: call.input,
          output: {},
          numericEvidence: [],
          success: false,
          error: 'Tool not in registry',
          durationMs: 0,
        });
        continue;
      }

      const executed = await this.toolExecutorService.execute(
        tenantId,
        actor,
        call.toolName,
        call.input,
      );
      executedToolCalls.push(executed);
    }

    const ragSources = plan.requiresRag
      ? await this.resolveRagSources(tenantId, {
          query: plan.ragQuery ?? defense.normalizedPrompt,
          topK: Number(this.configService.get<string>('AI_SEARCH_TOP_K', '5')),
        })
      : [];

    const answerCandidate = await this.providerService.generateAnswer({
      prompt: defense.normalizedPrompt,
      intent: plan.intent,
      toolResults: executedToolCalls.map((entry) => entry.output),
      ragSources,
      directAnswer: plan.directAnswer,
    });

    const numericEvidence = Array.from(
      new Set(executedToolCalls.flatMap((entry) => entry.numericEvidence)),
    );

    const numericsSafe = this.validateNumericProvenance(
      answerCandidate.answer,
      numericEvidence,
    );

    const confidence = Math.min(plan.confidence, answerCandidate.confidence);

    const shouldFallback =
      confidence < this.confidenceThreshold ||
      !numericsSafe ||
      executedToolCalls.some((entry) => !entry.success);

    const finalAnswer = shouldFallback
      ? "I don't know based on available data."
      : answerCandidate.answer;

    const finalConfidence = shouldFallback ? Math.min(confidence, 0.64) : confidence;

    const finalSources = shouldFallback ? [] : answerCandidate.sources;

    const assistantMessage = await this.persistAssistantMessage({
      tenantId,
      actor,
      conversationId: conversation.id,
      prompt: defense.normalizedPrompt,
      intent: plan.intent,
      answer: finalAnswer,
      confidence: finalConfidence,
      status: shouldFallback ? 'FALLBACK' : 'COMPLETED',
      sources: finalSources,
      toolCalls: executedToolCalls,
      cacheKey,
      cacheHit: false,
      promptInjectionMeta: {
        blocked: defense.blocked,
        flags: defense.flags,
        reason: defense.reason,
        numericsSafe,
      },
    });

    const cachePayload: ChatCachePayload = {
      conversationId: conversation.id,
      answer: finalAnswer,
      confidence: finalConfidence,
      intent: plan.intent,
      toolCalls: executedToolCalls,
      sources: finalSources,
    };

    await this.cacheService.set(cacheKey, cachePayload);

    return {
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      answer: finalAnswer,
      confidence: finalConfidence,
      intent: plan.intent,
      toolCalls: executedToolCalls,
      sources: finalSources,
      cacheHit: false,
    };
  }

  listTools() {
    return this.toolRegistryService.listTools().map((entry) => ({
      name: entry.name,
      description: entry.description,
      inputSchema: entry.inputSchema,
      permission: entry.permission,
    }));
  }

  async listMessages(
    tenantId: string,
    actor: Express.User,
    query: ListAiMessagesDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const isAdmin = this.isAdmin(actor);
    const requestedUserId = query.userId;

    if (requestedUserId && !isAdmin) {
      throw new ForbiddenException('Only TEAM_LEAD or SUPER_ADMIN can filter by userId');
    }

    const where: Prisma.AiMessageWhereInput = {
      tenantId,
      ...(query.conversationId ? { conversationId: query.conversationId } : {}),
      ...(query.status ? { status: query.status as AiMessageStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { prompt: { contains: query.search } },
              { answer: { contains: query.search } },
              { intent: { contains: query.search } },
            ],
          }
        : {}),
      ...(query.onlyAssistant ? { role: 'ASSISTANT' } : {}),
      ...(isAdmin
        ? requestedUserId
          ? { userId: requestedUserId }
          : {}
        : { userId: actor.sub }),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.aiMessage.count({ where }),
      this.prisma.aiMessage.findMany({
        where,
        include: {
          toolCalls: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items,
      page,
      limit,
      total,
    };
  }

  private async resolveConversation(
    tenantId: string,
    userId: string,
    conversationId: string | undefined,
    prompt: string,
  ) {
    if (conversationId) {
      const existing = await this.prisma.aiConversation.findFirst({
        where: {
          id: conversationId,
          tenantId,
          userId,
        },
      });

      if (existing) {
        return existing;
      }
    }

    return this.prisma.aiConversation.create({
      data: {
        tenantId,
        userId,
        title: prompt.slice(0, 120),
      },
    });
  }

  private async resolveRagSources(tenantId: string, query: SearchDocumentsDto) {
    const results = await this.documentSearchService.search(tenantId, query);
    return results.items;
  }

  private validateNumericProvenance(answer: string, evidence: number[]): boolean {
    const matches = answer.match(/-?\d+(?:\.\d+)?/g) ?? [];
    if (matches.length === 0) {
      return true;
    }

    const normalizedEvidence = new Set(
      evidence.map((entry) => Number(entry).toString()),
    );

    return matches.every((entry) => normalizedEvidence.has(Number(entry).toString()));
  }

  private async persistAssistantMessage(input: {
    tenantId: string;
    actor: Express.User;
    conversationId: string;
    prompt: string;
    intent: string;
    answer: string;
    confidence: number;
    status: AiMessageStatus;
    sources: Array<Record<string, unknown>>;
    toolCalls: ExecutedToolCall[];
    cacheKey: string;
    cacheHit: boolean;
    promptInjectionMeta: Record<string, unknown>;
  }) {
    const assistantMessage = await this.prisma.aiMessage.create({
      data: {
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        userId: input.actor.sub,
        role: 'ASSISTANT',
        prompt: input.prompt,
        answer: input.answer,
        intent: input.intent,
        confidence: input.confidence,
        sources: input.sources as Prisma.InputJsonValue,
        status: input.status,
        cacheKey: input.cacheKey,
        cacheHit: input.cacheHit,
      },
    });

    const promptLog = await this.prisma.aiPromptLog.create({
      data: {
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        userId: input.actor.sub,
        messageId: assistantMessage.id,
        normalizedPrompt: input.prompt,
        promptInjectionMeta: input.promptInjectionMeta as Prisma.InputJsonValue,
        selectedIntent: input.intent,
        toolPlan: input.toolCalls.map((entry) => ({
          toolName: entry.toolName,
          input: entry.input,
        })) as Prisma.InputJsonValue,
        finalResultSummary: {
          answer: input.answer,
          confidence: input.confidence,
          status: input.status,
        } as Prisma.InputJsonValue,
      },
    });

    for (const toolCall of input.toolCalls) {
      await this.prisma.aiToolCall.create({
        data: {
          tenantId: input.tenantId,
          messageId: assistantMessage.id,
          promptLogId: promptLog.id,
          toolName: toolCall.toolName,
          input: toolCall.input as Prisma.InputJsonValue,
          output: toolCall.output as Prisma.InputJsonValue,
          numericEvidence: toolCall.numericEvidence as unknown as Prisma.InputJsonValue,
          status: toolCall.success ? 'SUCCESS' : 'FAILED',
          success: toolCall.success,
          error: toolCall.error,
          durationMs: toolCall.durationMs,
        },
      });
    }

    await this.auditService.log({
      tenantId: input.tenantId,
      actorId: input.actor.sub,
      action: 'AI_CHAT_RESPONSE',
      entityType: 'AiMessage',
      entityId: assistantMessage.id,
      metadata: {
        intent: input.intent,
        confidence: input.confidence,
        cacheHit: input.cacheHit,
        toolCalls: input.toolCalls.length,
        status: input.status,
      },
    });

    return assistantMessage;
  }

  private isAdmin(actor: Express.User): boolean {
    const roles = actor.roles ?? [];
    return roles.includes(Role.SUPER_ADMIN) || roles.includes(Role.TEAM_LEAD);
  }
}
