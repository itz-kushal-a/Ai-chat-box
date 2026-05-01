import { Request, Response, NextFunction } from 'express';
import { callAI, buildMessages, extractJSON } from '../services/ai.service';
import { buildGenerateSystemPrompt, detectLanguage } from '../services/context.service';
import { recordUsage, hasTokenBudget } from '../services/token.service';
import { AppError } from '../middleware/error.middleware';
import { GenerateCodeRequest, GenerateCodeResponse, ApiResponse } from '../types';
import { logger } from '../utils/logger';

interface GenerateAIResponse {
  code: string;
  explanation: string;
  filename?: string;
}

// ─── POST /api/generate-code ──────────────────────────────────────────────────

export async function generateCode(req: Request, res: Response, next: NextFunction) {
  try {
    const { prompt, target, language = 'TypeScript', framework, context, filePath } =
      req.body as GenerateCodeRequest;

    const userId = req.user?.userId ?? 'anonymous';
    const plan   = req.user?.plan   ?? 'free';

    if (!hasTokenBudget(userId, plan)) {
      throw new AppError(429, 'Monthly AI token limit reached. Upgrade your plan for more.', 'TOKEN_LIMIT');
    }

    const detectedLang = language ?? detectLanguage(filePath);

    const system = buildGenerateSystemPrompt({
      target,
      language: detectedLang,
      framework,
      context,
    });

    const userPrompt = `Generate a ${target} for the following requirement:\n\n${prompt}`;
    const messages = buildMessages(userPrompt);
    const ai = await callAI({ system, messages, maxTokens: 1000 });

    recordUsage(userId, plan, ai.promptTokens, ai.completionTokens);

    // Parse structured JSON response from AI
    const parsed = extractJSON<GenerateAIResponse>(ai.content);

    if (!parsed || !parsed.code) {
      logger.warn('Generate response was not structured JSON, using raw content', { userId });
      const data: GenerateCodeResponse = {
        code:             ai.content.trim(),
        explanation:      `Generated ${target} based on your prompt.`,
        language:         detectedLang,
        promptTokens:     ai.promptTokens,
        completionTokens: ai.completionTokens,
        latencyMs:        ai.latencyMs,
      };
      return res.status(200).json({ success: true, data } satisfies ApiResponse<GenerateCodeResponse>);
    }

    const data: GenerateCodeResponse = {
      code:             parsed.code,
      explanation:      parsed.explanation ?? '',
      filename:         parsed.filename,
      language:         detectedLang,
      promptTokens:     ai.promptTokens,
      completionTokens: ai.completionTokens,
      latencyMs:        ai.latencyMs,
    };

    logger.info('Code generated', { userId, target, language: detectedLang, ms: ai.latencyMs });

    const response: ApiResponse<GenerateCodeResponse> = { success: true, data };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
