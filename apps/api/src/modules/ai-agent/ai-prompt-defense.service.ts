import { Injectable } from '@nestjs/common';

export interface PromptDefenseResult {
  normalizedPrompt: string;
  flags: string[];
  blocked: boolean;
  reason?: string;
}

@Injectable()
export class AiPromptDefenseService {
  private readonly injectionPatterns: Array<{ code: string; regex: RegExp }> = [
    { code: 'INJECT_IGNORE_PREVIOUS', regex: /ignore\s+(all\s+)?previous\s+instructions/i },
    { code: 'INJECT_SYSTEM_PROMPT', regex: /(show|reveal|print).*(system|developer)\s+prompt/i },
    { code: 'INJECT_BYPASS', regex: /(bypass|disable|override).*(guard|policy|security)/i },
    { code: 'INJECT_DATA_EXFIL', regex: /(dump|exfiltrate|export).*(database|secrets?|tokens?)/i },
  ];

  sanitize(prompt: string): PromptDefenseResult {
    const normalizedPrompt = prompt.replace(/\s+/g, ' ').trim();

    const flags = this.injectionPatterns
      .filter((entry) => entry.regex.test(normalizedPrompt))
      .map((entry) => entry.code);

    const blocked = flags.length > 0;

    return {
      normalizedPrompt,
      flags,
      blocked,
      reason: blocked
        ? 'Prompt injection risk detected; proceeding with restricted deterministic behavior.'
        : undefined,
    };
  }
}
