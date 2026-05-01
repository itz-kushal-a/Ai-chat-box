import Anthropic from '@anthropic-ai/sdk';
import { AIRequestOptions, AIResponse, ChatMessage } from '../types';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

// ─── Client singleton ─────────────────────────────────────────────────────────

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new AppError(500, 'ANTHROPIC_API_KEY is not configured', 'CONFIG_ERROR');
    client = new Anthropic({ apiKey });
  }
  return client;
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 1000;

// ─── Core completion call ─────────────────────────────────────────────────────

export async function callAI(options: AIRequestOptions): Promise<AIResponse> {
  const { system, messages, maxTokens = DEFAULT_MAX_TOKENS } = options;
  const start = Date.now();

  try {
    logger.debug('Calling Anthropic API', { model: DEFAULT_MODEL, maxTokens, messageCount: messages.length });

    const response = await getClient().messages.create({
      model: DEFAULT_MODEL,
      max_tokens: maxTokens,
      system,
      messages: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    });

    const content = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('');

    const latencyMs = Date.now() - start;

    logger.debug('Anthropic API response received', {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      latencyMs,
    });

    return {
      content,
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      latencyMs,
    };
  } catch (err: unknown) {
    logger.error('Anthropic API error', { message: (err as Error).message });

    if (err instanceof AppError) throw err;

    const errMsg = (err as Error).message ?? '';
    if (errMsg.includes('overloaded'))  throw new AppError(503, 'AI service is currently overloaded', 'AI_OVERLOADED');
    if (errMsg.includes('rate_limit'))  throw new AppError(429, 'AI rate limit reached',              'AI_RATE_LIMIT');
    if (errMsg.includes('invalid_api')) throw new AppError(500, 'Invalid Anthropic API key',          'AI_AUTH_ERROR');
    if (errMsg.includes('context_length_exceeded')) {
      throw new AppError(400, 'Request is too long for the AI model', 'CONTEXT_TOO_LONG');
    }

    throw new AppError(502, 'AI service error: ' + errMsg, 'AI_ERROR');
  }
}

// ─── Streaming call (returns AsyncIterable of text chunks) ────────────────────

export async function* streamAI(options: AIRequestOptions): AsyncGenerator<string> {
  const { system, messages, maxTokens = DEFAULT_MAX_TOKENS } = options;

  try {
    const stream = await getClient().messages.stream({
      model: DEFAULT_MODEL,
      max_tokens: maxTokens,
      system,
      messages: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  } catch (err: unknown) {
    logger.error('Anthropic stream error', { message: (err as Error).message });
    throw new AppError(502, 'AI stream error', 'AI_STREAM_ERROR');
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function buildMessages(userMessage: string, history: ChatMessage[] = []): ChatMessage[] {
  return [
    ...history.slice(-20), // keep last 20 messages for context window
    { role: 'user', content: userMessage },
  ];
}

export function extractCodeBlock(text: string): string {
  // Extract first fenced code block if present
  const match = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

export function extractJSON<T>(text: string): T | null {
  try {
    const match = text.match(/```json\n([\s\S]*?)```/) ?? text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[1] ?? match[0]) as T;
  } catch {
    return null;
  }
}
