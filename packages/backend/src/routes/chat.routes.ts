import { Router } from 'express';
import { chat, chatHealth } from '../controllers/chat.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { aiLimiter } from '../middleware/rateLimit.middleware';
import { validateChat } from '../middleware/validate.middleware';

const router = Router();

/**
 * GET /api/chat/health
 * Health check — no auth required
 */
router.get('/health', chatHealth);

/**
 * POST /api/chat
 * Send a message to the AI assistant.
 * Supports both standard JSON responses and SSE streaming (body.stream = true).
 *
 * Body: ChatRequest
 * Response: ApiResponse<ChatResponse> | SSE stream
 */
router.post('/', requireAuth, aiLimiter, validateChat, chat);

export default router;
