import { Router } from 'express';
import { fixCode } from '../controllers/fix.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { aiLimiter } from '../middleware/rateLimit.middleware';
import { validateFixCode } from '../middleware/validate.middleware';

const router = Router();

/**
 * POST /api/fix-code
 * Fix broken or buggy code. Optionally accepts an error message.
 *
 * Body: FixCodeRequest { code, error?, language?, filePath?, instructions? }
 * Response: ApiResponse<FixCodeResponse>
 */
router.post('/', requireAuth, aiLimiter, validateFixCode, fixCode);

export default router;
