import { extractJSON, extractCodeBlock, sanitizeCode } from './ai.service';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedFixResponse {
  fixedCode:   string;
  explanation: string;
  changes:     string[];
}

export interface ParsedGenerateResponse {
  code:        string;
  explanation: string;
  filename?:   string;
}

export interface ParsedExplainResponse {
  explanation: string;
}

// ─── Fix Code parser ──────────────────────────────────────────────────────────

export function parseFixResponse(rawText: string, originalCode: string): ParsedFixResponse {
  const parsed = extractJSON<Partial<ParsedFixResponse>>(rawText);

  if (parsed?.fixedCode) {
    return {
      fixedCode:   sanitizeCode(parsed.fixedCode),
      explanation: parsed.explanation ?? 'Code has been fixed.',
      changes:     Array.isArray(parsed.changes) ? parsed.changes : [],
    };
  }

  // Fallback: if AI didn't return JSON, try extracting a code block
  logger.warn('parseFixResponse: JSON parse failed, falling back to code block extraction');
  const codeBlock = extractCodeBlock(rawText);

  return {
    fixedCode:   codeBlock || originalCode,
    explanation: codeBlock ? 'Code has been corrected.' : 'Could not parse fix — original returned.',
    changes:     [],
  };
}

// ─── Generate Code parser ─────────────────────────────────────────────────────

export function parseGenerateResponse(rawText: string): ParsedGenerateResponse {
  const parsed = extractJSON<Partial<ParsedGenerateResponse>>(rawText);

  if (parsed?.code) {
    return {
      code:        sanitizeCode(parsed.code),
      explanation: parsed.explanation ?? '',
      filename:    parsed.filename,
    };
  }

  logger.warn('parseGenerateResponse: JSON parse failed, using raw code block');
  return {
    code:        extractCodeBlock(rawText),
    explanation: 'Generated from prompt.',
  };
}

// ─── Explain Code parser ──────────────────────────────────────────────────────

export function parseExplainResponse(rawText: string): ParsedExplainResponse {
  // Explanation is always prose — just clean up whitespace
  return {
    explanation: rawText.trim(),
  };
}

// ─── Chat response parser ─────────────────────────────────────────────────────

export interface ParsedChatResponse {
  reply:         string;
  codeBlocks:    string[];
  hasCode:       boolean;
}

export function parseChatResponse(rawText: string): ParsedChatResponse {
  const codeBlocks: string[] = [];
  const pattern = /```(?:\w+)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(rawText)) !== null) {
    codeBlocks.push(match[1].trim());
  }

  return {
    reply:      rawText.trim(),
    codeBlocks,
    hasCode:    codeBlocks.length > 0,
  };
}

// ─── Conversation title parser ────────────────────────────────────────────────

export function parseTitleResponse(rawText: string): string {
  return rawText
    .trim()
    .replace(/^["']|["']$/g, '')   // strip surrounding quotes
    .replace(/[.!?]$/, '')          // strip trailing punctuation
    .slice(0, 80);                  // enforce max length
}

// ─── SSE event formatter ──────────────────────────────────────────────────────

export function formatSSEChunk(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export function formatSSEDone(conversationId: string): string {
  return formatSSEChunk({ done: true, conversationId });
}

export function formatSSEError(message: string): string {
  return formatSSEChunk({ error: message });
}

// ─── Generic response wrapper ─────────────────────────────────────────────────

export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return { success: true as const, data, ...(meta ? { meta } : {}) };
}

export function fail(error: string) {
  return { success: false as const, error };
}
