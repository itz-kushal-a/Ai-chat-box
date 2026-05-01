import { Request, Response, NextFunction } from 'express';
import { callAI, buildMessages } from '../services/ai.service';
import { buildExplainSystemPrompt, detectLanguage } from '../services/context.service';
import { recordUsage, hasTokenBudget } from '../services/token.service';
import { AppError } from '../middleware/error.middleware';
import { ExplainCodeRequest, ExplainCodeResponse, ApiResponse } from '../types';
import { logger } from '../utils/logger';

// ─── POST /api/explain-code ───────────────────────────────────────────────────

export async function explainCode(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, language, filePath, detail = 'full' } = req.body as ExplainCodeRequest;

    const userId = req.user?.userId ?? 'anonymous';
    const plan   = req.user?.plan   ?? 'free';

    if (!hasTokenBudget(userId, plan)) {
      throw new AppError(429, 'Monthly AI token limit reached. Upgrade your plan for more.', 'TOKEN_LIMIT');
    }

    const detectedLang = language ?? detectLanguage(filePath, code);

    const system = buildExplainSystemPrompt({ language: detectedLang, filePath, detail });
    const messages = buildMessages(
      `Please explain the following code:\n\n\`\`\`${detectedLang.toLowerCase()}\n${code}\n\`\`\``,
    );

    const ai = await callAI({ system, messages, maxTokens: detail === 'brief' ? 300 : 800 });

    recordUsage(userId, plan, ai.promptTokens, ai.completionTokens);

    const data: ExplainCodeResponse = {
      explanation:      ai.content,
      language:         detectedLang,
      promptTokens:     ai.promptTokens,
      completionTokens: ai.completionTokens,
      latencyMs:        ai.latencyMs,
    };

    logger.info('Code explained', { userId, language: detectedLang, ms: ai.latencyMs });

    const response: ApiResponse<ExplainCodeResponse> = { success: true, data };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
