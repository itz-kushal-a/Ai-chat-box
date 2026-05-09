import { Request, Response, NextFunction } from 'express';
import { callAI, buildMessages } from '../services/ai.service';
import { PromptTemplates, detectLanguage } from '../services/prompt.service';
import { parseFixResponse, ok } from '../services/response.service';
import { recordUsage, hasTokenBudget } from '../services/token.service';
import { AppError } from '../middleware/error.middleware';
import { FixCodeRequest, FixCodeResponse } from '../types';
import { logger } from '../utils/logger';

// ─── POST /api/fix-code ───────────────────────────────────────────────────────

export async function fixCode(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, error: codeError, language, filePath, instructions } =
      req.body as FixCodeRequest;

    const userId = req.user?.userId ?? 'anonymous';
    const plan   = req.user?.plan   ?? 'free';

    if (!hasTokenBudget(userId, plan)) {
      throw new AppError(429, 'Monthly AI token limit reached.', 'TOKEN_LIMIT');
    }

    const detectedLang = language ?? detectLanguage(filePath, code);

    const system   = PromptTemplates.fixCode.system({ language: detectedLang, filePath });
    const userMsg  = PromptTemplates.fixCode.user({ code, error: codeError, instructions, language: detectedLang });
    const messages = buildMessages(userMsg);

    const ai = await callAI({ system, messages, maxTokens: 1000 });

    recordUsage(userId, plan, ai.promptTokens, ai.completionTokens);

    const parsed = parseFixResponse(ai.content, code);

    const data: FixCodeResponse = {
      fixedCode:        parsed.fixedCode,
      explanation:      parsed.explanation,
      changes:          parsed.changes,
      language:         detectedLang,
      promptTokens:     ai.promptTokens,
      completionTokens: ai.completionTokens,
      latencyMs:        ai.latencyMs,
    };

    logger.info('Code fixed', { userId, language: detectedLang, changes: parsed.changes.length, ms: ai.latencyMs });

    res.status(200).json(ok(data));
  } catch (err) {
    next(err);
  }
}
