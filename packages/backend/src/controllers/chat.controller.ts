import { Request, Response, NextFunction } from 'express';
import { callAI, streamAI, buildMessages, checkAIHealth } from '../services/ai.service';
import { PromptTemplates, buildTitlePrompt } from '../services/prompt.service';
import { parseChatResponse, parseTitleResponse, formatSSEChunk, formatSSEDone, formatSSEError, ok } from '../services/response.service';
import { getOrCreate, appendMessage, getHistory, updateTitle, getUserConversations, deleteConversation } from '../services/conversation.service';
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

    if (!hasTokenBudget(userId, plan)) {
      throw new AppError(429, 'Monthly AI token limit reached. Upgrade your plan for more.', 'TOKEN_LIMIT');
    }

    // Get or create conversation (memory layer)
    const conv    = getOrCreate(conversationId, userId, filePath);
    const convHistory = getHistory(conv.id);

    // Build prompts from templates
    const system   = PromptTemplates.chat.system({ filePath, selectedCode });
    const userMsg  = PromptTemplates.chat.user({ message });
    const messages = buildMessages(userMsg, history.length ? history : convHistory);

    // Save user message
    appendMessage(conv.id, { role: 'user', content: message });

    // ── Streaming response ──────────────────────────────────────────────────
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Conversation-Id', conv.id);

      let fullReply = '';
      try {
        for await (const chunk of streamAI({ system, messages })) {
          fullReply += chunk;
          res.write(formatSSEChunk({ chunk, conversationId: conv.id }));
        }
        appendMessage(conv.id, { role: 'assistant', content: fullReply });
        res.write(formatSSEDone(conv.id));
        res.end();
      } catch {
        res.write(formatSSEError('Stream interrupted — please retry'));
        res.end();
      }
      return;
    }

    // ── Standard response ───────────────────────────────────────────────────
    const ai = await callAI({ system, messages });
    const parsed = parseChatResponse(ai.content);

    // Save assistant message
    appendMessage(conv.id, { role: 'assistant', content: parsed.reply }, ai.promptTokens + ai.completionTokens);
    recordUsage(userId, plan, ai.promptTokens, ai.completionTokens);

    // Auto-generate title from first message
    if (conv.messages.length === 2) {
      try {
        const { system: tSys, userMsg: tMsg } = buildTitlePrompt(message);
        const titleAI = await callAI({ system: tSys, messages: [{ role: 'user', content: tMsg }], maxTokens: 20 });
        updateTitle(conv.id, parseTitleResponse(titleAI.content));
      } catch {
        // Non-critical — title generation failing shouldn't break the response
      }
    }

    const data: ChatResponse = {
      reply:            parsed.reply,
      conversationId:   conv.id,
      promptTokens:     ai.promptTokens,
      completionTokens: ai.completionTokens,
      latencyMs:        ai.latencyMs,
    };

    logger.info('Chat completed', { userId, convId: conv.id, tokens: ai.promptTokens + ai.completionTokens, ms: ai.latencyMs });

    res.status(200).json(ok(data));
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/chat/conversations ──────────────────────────────────────────────

export function listConversations(req: Request, res: Response) {
  const userId = req.user?.userId ?? 'anonymous';
  const convs = getUserConversations(userId).map(c => ({
    id:           c.id,
    title:        c.title,
    messageCount: c.messages.length,
    totalTokens:  c.totalTokens,
    filePath:     c.filePath,
    createdAt:    c.createdAt,
    updatedAt:    c.updatedAt,
  }));
  res.json(ok(convs));
}

// ─── DELETE /api/chat/conversations/:id ───────────────────────────────────────

export function deleteConv(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.userId ?? 'anonymous';
  const deleted = deleteConversation(req.params.id, userId);
  if (!deleted) return next(new AppError(404, 'Conversation not found', 'NOT_FOUND'));
  res.json(ok({ deleted: true }));
}

// ─── GET /api/chat/health ─────────────────────────────────────────────────────

export async function chatHealth(_req: Request, res: Response) {
  const health = await checkAIHealth();
  const status = health.ok ? 200 : 503;
  res.status(status).json(ok(health));
}
