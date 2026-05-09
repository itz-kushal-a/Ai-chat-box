import { Request, Response, NextFunction } from 'express';
import { callAI, buildMessages } from '../services/ai.service';
import { PromptTemplates, detectLanguage } from '../services/prompt.service';
import { parseGenerateResponse, ok } from '../services/response.service';
import { recordUsage, hasTokenBudget } from '../services/token.service';
import { AppError } from '../middleware/error.middleware';
import { GenerateCodeRequest, GenerateCodeResponse } from '../types';
import { logger } from '../utils/logger';

// ─── POST /api/generate-code ──────────────────────────────────────────────────

export async function generateCode(req: Request, res: Response, next: NextFunction) {
  try {
    const { prompt, target, language = 'TypeScript', framework, context, filePath } =
      req.body as GenerateCodeRequest;

    const userId = req.user?.userId ?? 'anonymous';
    const plan   = req.user?.plan   ?? 'free';

    if (!hasTokenBudget(userId, plan)) {
      throw new AppError(429, 'Monthly AI token limit reached.', 'TOKEN_LIMIT');
    }

    const detectedLang = language ?? detectLanguage(filePath);

    const system   = PromptTemplates.generateCode.system({ target, language: detectedLang, framework, context });
    const userMsg  = PromptTemplates.generateCode.user({ prompt, target });
    const messages = buildMessages(userMsg);

    const ai = await callAI({ system, messages, maxTokens: 1000 });

    recordUsage(userId, plan, ai.promptTokens, ai.completionTokens);

    const parsed = parseGenerateResponse(ai.content);

    const data: GenerateCodeResponse = {
      code:             parsed.code,
      explanation:      parsed.explanation,
      filename:         parsed.filename,
      language:         detectedLang,
      promptTokens:     ai.promptTokens,
      completionTokens: ai.completionTokens,
      latencyMs:        ai.latencyMs,
    };

    logger.info('Code generated', { userId, target, language: detectedLang, ms: ai.latencyMs });

    res.status(200).json(ok(data));
  } catch (err) {
    next(err);
  }
}
