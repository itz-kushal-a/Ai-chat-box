import { Request, Response, NextFunction } from 'express';
import { callAI, buildMessages, extractJSON } from '../services/ai.service';
import { buildFixSystemPrompt, detectLanguage } from '../services/context.service';
import { recordUsage, hasTokenBudget } from '../services/token.service';
import { AppError } from '../middleware/error.middleware';
import { FixCodeRequest, FixCodeResponse, ApiResponse } from '../types';
import { logger } from '../utils/logger';

interface FixAIResponse {
  fixedCode: string;
  explanation: string;
  changes: string[];
}

// ─── POST /api/fix-code ───────────────────────────────────────────────────────

export async function fixCode(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, error: codeError, language, filePath, instructions } =
      req.body as FixCodeRequest;

    const userId = req.user?.userId ?? 'anonymous';
    const plan   = req.user?.plan   ?? 'free';

    if (!hasTokenBudget(userId, plan)) {
      throw new AppError(429, 'Monthly AI token limit reached. Upgrade your plan for more.', 'TOKEN_LIMIT');
    }

    const detectedLang = language ?? detectLanguage(filePath, code);

    const system = buildFixSystemPrompt({
      language: detectedLang,
      filePath,
      errorMessage: codeError,
    });

    let userPrompt = `Fix the following ${detectedLang} code:\n\n\`\`\`${detectedLang.toLowerCase()}\n${code}\n\`\`\``;
    if (codeError) userPrompt += `\n\nError message:\n${codeError}`;
    if (instructions) userPrompt += `\n\nAdditional instructions:\n${instructions}`;

    const messages = buildMessages(userPrompt);
    const ai = await callAI({ system, messages, maxTokens: 1000 });

    recordUsage(userId, plan, ai.promptTokens, ai.completionTokens);

    // Parse structured JSON response from AI
    const parsed = extractJSON<FixAIResponse>(ai.content);

    if (!parsed || !parsed.fixedCode) {
      // Fallback: treat entire response as the fixed code
      logger.warn('Fix response was not structured JSON, using raw content', { userId });
      const data: FixCodeResponse = {
        fixedCode:        ai.content.trim(),
        explanation:      'Code has been fixed.',
        changes:          [],
        language:         detectedLang,
        promptTokens:     ai.promptTokens,
        completionTokens: ai.completionTokens,
        latencyMs:        ai.latencyMs,
      };
      return res.status(200).json({ success: true, data } satisfies ApiResponse<FixCodeResponse>);
    }

    const data: FixCodeResponse = {
      fixedCode:        parsed.fixedCode,
      explanation:      parsed.explanation ?? '',
      changes:          parsed.changes     ?? [],
      language:         detectedLang,
      promptTokens:     ai.promptTokens,
      completionTokens: ai.completionTokens,
      latencyMs:        ai.latencyMs,
    };

    logger.info('Code fixed', { userId, language: detectedLang, changes: data.changes.length, ms: ai.latencyMs });

    const response: ApiResponse<FixCodeResponse> = { success: true, data };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
