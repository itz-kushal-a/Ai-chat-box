import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { AIRequestOptions, AIResponse, ChatMessage } from '../types';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

// ─── Anthropic client singleton ───────────────────────────────────────────────

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    if (!config.anthropic.apiKey) {
      throw new AppError(500, 'ANTHROPIC_API_KEY is not configured', 'CONFIG_ERROR');
    }
    _client = new Anthropic({
      apiKey:  config.anthropic.apiKey,
      timeout: config.anthropic.timeoutMs,
    });
  }
  return _client;
}

// ─── Error classifier ─────────────────────────────────────────────────────────

function classifyError(err: unknown): AppError {
  const msg = (err as Error)?.message ?? '';

  if (msg.includes('overloaded'))           return new AppError(503, 'AI service is currently overloaded — please retry shortly', 'AI_OVERLOADED');
  if (msg.includes('rate_limit'))           return new AppError(429, 'Anthropic rate limit reached',                               'AI_RATE_LIMIT');
  if (msg.includes('invalid_api_key'))      return new AppError(500, 'Invalid Anthropic API key',                                  'AI_AUTH_ERROR');
  if (msg.includes('context_length'))       return new AppError(400, 'Prompt is too long for the model',                          'CONTEXT_TOO_LONG');
  if (msg.includes('timeout'))              return new AppError(504, 'AI service timed out',                                       'AI_TIMEOUT');
  if (msg.includes('network') || msg.includes('ECONNREFUSED')) {
    return new AppError(503, 'Cannot reach AI service — check network', 'AI_NETWORK');
  }
  return new AppError(502, `AI service error: ${msg}`, 'AI_ERROR');
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = config.anthropic.maxRetries,
  delayMs = config.anthropic.retryDelayMs,
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const classified = classifyError(err);

      // Only retry on transient errors
      const isRetryable = ['AI_OVERLOADED', 'AI_RATE_LIMIT', 'AI_TIMEOUT', 'AI_NETWORK'].includes(
        classified.code ?? '',
      );

      if (!isRetryable || attempt === retries) break;

      const backoff = delayMs * Math.pow(2, attempt - 1); // exponential backoff
      logger.warn(`AI call failed (attempt ${attempt}/${retries}), retrying in ${backoff}ms`, {
        code: classified.code,
        message: classified.message,
      });
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }

  throw classifyError(lastErr);
}

// ─── Map ChatMessage[] → Anthropic MessageParam[] ────────────────────────────

function toAnthropicMessages(messages: ChatMessage[]) {
  return messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

// ─── Standard (non-streaming) completion ─────────────────────────────────────

export async function callAI(options: AIRequestOptions): Promise<AIResponse> {
  const { system, messages, maxTokens = config.anthropic.maxTokens } = options;
  const start = Date.now();

  logger.debug('→ AI request', {
    model: config.anthropic.model,
    maxTokens,
    msgCount: messages.length,
    systemLen: system.length,
  });

  const response = await withRetry(() =>
    getClient().messages.create({
      model:      config.anthropic.model,
      max_tokens: maxTokens,
      system,
      messages:   toAnthropicMessages(messages),
    }),
  );

  const content = response.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('');

  const latencyMs = Date.now() - start;

  logger.debug('← AI response', {
    promptTokens:     response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
    latencyMs,
    stopReason:       response.stop_reason,
  });

  return {
    content,
    promptTokens:     response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
    latencyMs,
  };
}

// ─── Streaming completion ─────────────────────────────────────────────────────

export async function* streamAI(options: AIRequestOptions): AsyncGenerator<string> {
  const { system, messages, maxTokens = config.anthropic.maxTokens } = options;

  logger.debug('→ AI stream request', { model: config.anthropic.model, maxTokens });

  try {
    const stream = await withRetry(() =>
      getClient().messages.stream({
        model:      config.anthropic.model,
        max_tokens: maxTokens,
        system,
        messages:   toAnthropicMessages(messages),
      }),
    );

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  } catch (err) {
    throw classifyError(err);
  }
}

// ─── Convenience builders ─────────────────────────────────────────────────────

export function buildMessages(userMessage: string, history: ChatMessage[] = []): ChatMessage[] {
  // Keep last 20 messages to stay within context window
  const trimmedHistory = history.slice(-20);
  return [...trimmedHistory, { role: 'user', content: userMessage }];
}

// ─── Response parsers ─────────────────────────────────────────────────────────

/** Extract the first fenced code block from AI output */
export function extractCodeBlock(text: string): string {
  const match = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

/** Parse a JSON object from AI output — handles both raw JSON and fenced blocks */
export function extractJSON<T>(text: string): T | null {
  const sources = [
    // ```json ... ``` block
    text.match(/```json\s*\n([\s\S]*?)```/)?.[1],
    // ``` ... ``` block (no language tag)
    text.match(/```\s*\n([\s\S]*?)```/)?.[1],
    // Raw JSON object anywhere in text
    text.match(/\{[\s\S]*\}/)?.[0],
  ];

  for (const src of sources) {
    if (!src) continue;
    try {
      return JSON.parse(src.trim()) as T;
    } catch {
      continue;
    }
  }

  logger.warn('extractJSON: could not parse AI response as JSON', { preview: text.slice(0, 100) });
  return null;
}

/** Sanitize AI-generated code — remove markdown fences if the AI wrapped the output */
export function sanitizeCode(text: string): string {
  return text
    .replace(/^```[\w]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
}

// ─── Health check ─────────────────────────────────────────────────────────────

export async function checkAIHealth(): Promise<{ ok: boolean; model: string; latencyMs?: number }> {
  const start = Date.now();
  try {
    await getClient().messages.create({
      model:      config.anthropic.model,
      max_tokens: 5,
      messages:   [{ role: 'user', content: 'hi' }],
    });
    return { ok: true, model: config.anthropic.model, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, model: config.anthropic.model };
  }
}
