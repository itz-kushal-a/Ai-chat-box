import { Router, Request, Response } from 'express';
import chatRoutes    from './chat.routes';
import explainRoutes from './explain.routes';
import fixRoutes     from './fix.routes';
import generateRoutes from './generate.routes';
import { apiLimiter } from '../middleware/rateLimit.middleware';
import { ApiResponse } from '../types';

const router = Router();

// Apply general rate limit to all /api routes
router.use(apiLimiter);

// ─── Mount feature routers ────────────────────────────────────────────────────

router.use('/chat',          chatRoutes);
router.use('/explain-code',  explainRoutes);
router.use('/fix-code',      fixRoutes);
router.use('/generate-code', generateRoutes);

// ─── API info ─────────────────────────────────────────────────────────────────

router.get('/', (_req: Request, res: Response) => {
  const response: ApiResponse<{
    version: string;
    endpoints: string[];
    docs: string;
  }> = {
    success: true,
    data: {
      version: '1.0.0',
      endpoints: [
        'POST /api/chat',
        'POST /api/explain-code',
        'POST /api/fix-code',
        'POST /api/generate-code',
        'GET  /api/chat/health',
      ],
      docs: 'See docs/System_Architecture.md for full API documentation',
    },
  };
  res.json(response);
});

export default router;
