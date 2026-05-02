export interface AiProviderToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface PlannedToolCall {
  toolName: string;
  input: Record<string, unknown>;
}

export interface AiPlanResult {
  intent: string;
  confidence: number;
  requiresRag: boolean;
  ragQuery?: string;
  directAnswer?: string;
  toolCalls: PlannedToolCall[];
}

export interface AiAnswerResult {
  answer: string;
  confidence: number;
  sources: Array<Record<string, unknown>>;
}

export interface AiProvider {
  generatePlan(input: {
    prompt: string;
    tools: AiProviderToolDefinition[];
  }): Promise<AiPlanResult>;

  generateAnswer(input: {
    prompt: string;
    intent: string;
    toolResults: Array<Record<string, unknown>>;
    ragSources: Array<Record<string, unknown>>;
    directAnswer?: string;
  }): Promise<AiAnswerResult>;

  embedTexts(texts: string[]): Promise<number[][]>;
}
