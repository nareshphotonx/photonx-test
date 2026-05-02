import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { Role } from '../../common/enums/role.enum';
import { AiAgentService } from './ai-agent.service';

describe('AiAgentService', () => {
  const prisma = {
    aiMessage: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    aiConversation: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    aiPromptLog: {
      create: jest.fn(),
    },
    aiToolCall: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const configService = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'AI_CONFIDENCE_THRESHOLD') {
        return '0.65';
      }
      if (key === 'AI_SEARCH_TOP_K') {
        return '5';
      }
      return fallback;
    }),
  } as unknown as ConfigService;

  const auditService = {
    log: jest.fn(),
  } as any;

  const promptDefenseService = {
    sanitize: jest.fn(),
  } as any;

  const cacheService = {
    buildCacheKey: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  } as any;

  const toolRegistryService = {
    listTools: jest.fn(),
    hasTool: jest.fn(),
  } as any;

  const toolExecutorService = {
    execute: jest.fn(),
  } as any;

  const providerService = {
    generatePlan: jest.fn(),
    generateAnswer: jest.fn(),
  } as any;

  const documentSearchService = {
    search: jest.fn(),
  } as any;

  const service = new AiAgentService(
    prisma,
    configService,
    auditService,
    promptDefenseService,
    cacheService,
    toolRegistryService,
    toolExecutorService,
    providerService,
    documentSearchService,
  );

  const actor: Express.User = {
    sub: 'user_1',
    tenantId: 'tenant_1',
    sessionId: 'session_1',
    roles: [Role.USER],
    permissions: [PERMISSIONS.AI_CHAT, PERMISSIONS.AI_MESSAGES_READ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    let messageCounter = 0;
    prisma.aiMessage.create = jest.fn().mockImplementation(({ data }: any) => {
      messageCounter += 1;
      return {
        id: `msg_${messageCounter}`,
        ...data,
      };
    });
    prisma.aiConversation.findFirst = jest.fn().mockResolvedValue(null);
    prisma.aiConversation.create = jest.fn().mockResolvedValue({ id: 'conv_1' });
    prisma.aiPromptLog.create = jest.fn().mockResolvedValue({ id: 'prompt_1' });
    prisma.aiToolCall.create = jest.fn().mockResolvedValue({ id: 'tool_1' });
    prisma.aiMessage.count = jest.fn().mockResolvedValue(0);
    prisma.aiMessage.findMany = jest.fn().mockResolvedValue([]);
    prisma.$transaction = jest.fn().mockImplementation(async (queries: any[]) =>
      Promise.all(queries),
    );

    promptDefenseService.sanitize = jest.fn().mockReturnValue({
      normalizedPrompt: 'show my leave balance',
      flags: [],
      blocked: false,
      reason: undefined,
    });

    cacheService.buildCacheKey = jest.fn().mockReturnValue('ai:chat:tenant_1:key');
    cacheService.get = jest.fn().mockResolvedValue(null);
    cacheService.set = jest.fn().mockResolvedValue(undefined);

    toolRegistryService.listTools = jest.fn().mockReturnValue([
      {
        name: 'get_user_leave_balance',
        description: 'Get leave balance',
        inputSchema: { type: 'object' },
        permission: PERMISSIONS.AI_CHAT,
      },
    ]);
    toolRegistryService.hasTool = jest.fn().mockReturnValue(true);

    toolExecutorService.execute = jest.fn().mockResolvedValue({
      toolName: 'get_user_leave_balance',
      input: {},
      output: { totalBalance: 8 },
      numericEvidence: [8],
      success: true,
      durationMs: 2,
    });

    providerService.generatePlan = jest.fn().mockResolvedValue({
      intent: 'LEAVE_BALANCE',
      confidence: 0.92,
      requiresRag: false,
      toolCalls: [{ toolName: 'get_user_leave_balance', input: {} }],
    });

    providerService.generateAnswer = jest.fn().mockResolvedValue({
      answer: 'Your leave balance is 9 days.',
      confidence: 0.9,
      sources: [{ source: 'tool', reference: 'get_user_leave_balance' }],
    });

    documentSearchService.search = jest.fn().mockResolvedValue({ items: [] });
  });

  it('falls back when numeric claim is not present in tool evidence', async () => {
    const result = await service.chat('tenant_1', actor, {
      prompt: 'show my leave balance',
    });

    expect(result.answer).toBe("I don't know based on available data.");
    expect(result.confidence).toBeLessThan(0.65);
    expect(prisma.aiToolCall.create).toHaveBeenCalledTimes(1);
    expect(cacheService.set).toHaveBeenCalledTimes(1);
  });

  it('blocks USER from listing another user messages', async () => {
    await expect(
      service.listMessages('tenant_1', actor, {
        userId: 'user_2',
        page: 1,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
