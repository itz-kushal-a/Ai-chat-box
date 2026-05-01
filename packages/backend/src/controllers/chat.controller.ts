import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { callAI, streamAI, buildMessages } from '../services/ai.service';
import { buildChatSystemPrompt } from '../services/context.service';
import { recordUsage, hasTokenBudget } from '../services/token.service';
import { AppError } from '../middleware/error.middleware';
import { ChatRequest, ChatResponse, ApiResponse } from '../types';
import { logger } from '../utils/logger';

// ─── POST /api/chat ───────────────────────────────────────────────────────────

export async function chat(req: Request, res: Response, next: NextFunction) {
  try {
    const { message, history = [], selectedCode, filePath, conversationId, stream = false } =
      req.body as ChatRequest;

    const userId = req.user?.userId ?? 'anonymous';
    const plan   = req.user?.plan   ?? 'free';

    // Token budget check
    if (!hasTokenBudget(userId, plan)) {
      throw new AppError(429, 'Monthly AI token limit reached. Upgrade your plan for more.', 'TOKEN_LIMIT');
    }

    const convId  = conversationId ?? uuidv4();
    const system  = buildChatSystemPrompt({ filePath, selectedCode });
    const messages = buildMessages(message, history);

    // ── Streaming response ──────────────────────────────────────────────────
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Conversation-Id', convId);

      let totalContent = '';
      try {
        for await (const chunk of streamAI({ system, messages })) {
          totalContent += chunk;
          res.write(`data: ${JSON.stringify({ chunk, conversationId: convId })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ done: true, conversationId: convId })}\n\n`);
        res.end();
        logger.debug('Stream completed', { userId, convId, chars: totalContent.length });
      } catch (streamErr) {
        res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
        res.end();
      }
      return;
    }

    // ── Standard response ───────────────────────────────────────────────────
    const ai = await callAI({ system, messages });

    recordUsage(userId, plan, ai.promptTokens, ai.completionTokens);

    const data: ChatResponse = {
      reply:            ai.content,
      conversationId:   convId,
      promptTokens:     ai.promptTokens,
      completionTokens: ai.completionTokens,
      latencyMs:        ai.latencyMs,
    };

    logger.info('Chat completed', { userId, convId, tokens: ai.promptTokens + ai.completionTokens, ms: ai.latencyMs });

    const response: ApiResponse<ChatResponse> = { success: true, data };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/chat/health ─────────────────────────────────────────────────────

export function chatHealth(_req: Request, res: Response) {
  const response: ApiResponse<{ status: string }> = {
    success: true,
    data: { status: 'Chat service is running' },
  };
  res.json(response);
}
