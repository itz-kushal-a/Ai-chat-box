import { Router } from 'express';
import { explainCode } from '../controllers/explain.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { aiLimiter } from '../middleware/rateLimit.middleware';
import { validateExplainCode } from '../middleware/validate.middleware';

const router = Router();

/**
 * POST /api/explain-code
 * Explain a block of code in plain English.
 *
 * Body: ExplainCodeRequest { code, language?, filePath?, detail? }
 * Response: ApiResponse<ExplainCodeResponse>
 */
router.post('/', requireAuth, aiLimiter, validateExplainCode, explainCode);

export default router;
