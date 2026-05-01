import { Router } from 'express';
import { generateCode } from '../controllers/generate.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { aiLimiter, strictLimiter } from '../middleware/rateLimit.middleware';
import { validateGenerateCode } from '../middleware/validate.middleware';

const router = Router();

/**
 * POST /api/generate-code
 * Generate new code from a plain-English prompt.
 * Uses strictLimiter (3/min) as generation is the most expensive operation.
 *
 * Body: GenerateCodeRequest { prompt, target, language?, framework?, context? }
 * Response: ApiResponse<GenerateCodeResponse>
 */
router.post('/', requireAuth, aiLimiter, strictLimiter, validateGenerateCode, generateCode);

export default router;
