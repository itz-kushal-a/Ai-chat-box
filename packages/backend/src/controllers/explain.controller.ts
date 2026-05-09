import { Request, Response, NextFunction } from 'express';
import { callAI, buildMessages } from '../services/ai.service';
import { PromptTemplates, detectLanguage } from '../services/prompt.service';
import { parseExplainResponse, ok } from '../services/response.service';
import { recordUsage, hasTokenBudget } from '../services/token.service';
import { AppError } from '../middleware/error.middleware';
import { ExplainCodeRequest, ExplainCodeResponse } from '../types';
import { logger } from '../utils/logger';

// ─── POST /api/explain-code ───────────────────────────────────────────────────

export async function explainCode(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, language, filePath, detail = 'full' } = req.body as ExplainCodeRequest;

    const userId = req.user?.userId ?? 'anonymous';
    const plan   = req.user?.plan   ?? 'free';

    if (!hasTokenBudget(userId, plan)) {
      throw new AppError(429, 'Monthly AI token limit reached.', 'TOKEN_LIMIT');
    }

    const detectedLang = language ?? detectLanguage(filePath, code);

    const system   = PromptTemplates.explainCode.system({ language: detectedLang, filePath, detail });
    const userMsg  = PromptTemplates.explainCode.user({ code, language: detectedLang });
    const messages = buildMessages(userMsg);

    const maxTokens = detail === 'brief' ? 300 : 800;
    const ai = await callAI({ system, messages, maxTokens });

    recordUsage(userId, plan, ai.promptTokens, ai.completionTokens);

    const parsed = parseExplainResponse(ai.content);

    const data: ExplainCodeResponse = {
      explanation:      parsed.explanation,
      language:         detectedLang,
      promptTokens:     ai.promptTokens,
      completionTokens: ai.completionTokens,
      latencyMs:        ai.latencyMs,
    };

    logger.info('Code explained', { userId, language: detectedLang, detail, ms: ai.latencyMs });

    res.status(200).json(ok(data));
  } catch (err) {
    next(err);
  }
}
