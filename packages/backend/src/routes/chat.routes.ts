import { Router } from 'express';
import { chat, chatHealth, listConversations, deleteConv } from '../controllers/chat.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { aiLimiter } from '../middleware/rateLimit.middleware';
import { validateChat } from '../middleware/validate.middleware';

const router = Router();

/** GET  /api/chat/health — AI health check, no auth */
router.get('/health', chatHealth);

/** GET  /api/chat/conversations — list user's conversations */
router.get('/conversations', requireAuth, listConversations);

/** DELETE /api/chat/conversations/:id — delete a conversation */
router.delete('/conversations/:id', requireAuth, deleteConv);

/** POST /api/chat — send a message (REST or SSE stream) */
router.post('/', requireAuth, aiLimiter, validateChat, chat);

export default router;
