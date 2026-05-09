import { v4 as uuidv4 } from 'uuid';
import { ChatMessage } from '../types';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Conversation {
  id:           string;
  userId:       string;
  title:        string;
  messages:     ChatMessage[];
  createdAt:    Date;
  updatedAt:    Date;
  totalTokens:  number;
  filePath?:    string;
}

// ─── In-memory store (swap for DB/Redis in production) ────────────────────────

const store = new Map<string, Conversation>();

// Auto-expire conversations after 24 hours of inactivity
const TTL_MS = 24 * 60 * 60 * 1000;

// ─── Create ───────────────────────────────────────────────────────────────────

export function createConversation(userId: string, filePath?: string): Conversation {
  const conv: Conversation = {
    id:          uuidv4(),
    userId,
    title:       'New conversation',
    messages:    [],
    createdAt:   new Date(),
    updatedAt:   new Date(),
    totalTokens: 0,
    filePath,
  };
  store.set(conv.id, conv);
  logger.debug('Conversation created', { id: conv.id, userId });
  return conv;
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export function getConversation(id: string): Conversation | null {
  return store.get(id) ?? null;
}

export function getUserConversations(userId: string): Conversation[] {
  return Array.from(store.values())
    .filter(c => c.userId === userId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

// ─── Get or create ────────────────────────────────────────────────────────────

export function getOrCreate(conversationId: string | undefined, userId: string, filePath?: string): Conversation {
  if (conversationId) {
    const existing = store.get(conversationId);
    if (existing && existing.userId === userId) return existing;
  }
  return createConversation(userId, filePath);
}

// ─── Append message ───────────────────────────────────────────────────────────

export function appendMessage(
  conversationId: string,
  message: ChatMessage,
  tokens = 0,
): void {
  const conv = store.get(conversationId);
  if (!conv) return;

  conv.messages.push(message);
  conv.totalTokens += tokens;
  conv.updatedAt = new Date();

  // Keep only last 40 messages to prevent memory bloat
  if (conv.messages.length > 40) {
    conv.messages = conv.messages.slice(-40);
  }
}

// ─── Update title ─────────────────────────────────────────────────────────────

export function updateTitle(conversationId: string, title: string): void {
  const conv = store.get(conversationId);
  if (conv) {
    conv.title     = title;
    conv.updatedAt = new Date();
  }
}

// ─── Get history for AI context window ───────────────────────────────────────

export function getHistory(conversationId: string, limit = 20): ChatMessage[] {
  const conv = store.get(conversationId);
  if (!conv) return [];
  return conv.messages.slice(-limit);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function deleteConversation(conversationId: string, userId: string): boolean {
  const conv = store.get(conversationId);
  if (!conv || conv.userId !== userId) return false;
  store.delete(conversationId);
  return true;
}

// ─── Clear all for user ───────────────────────────────────────────────────────

export function clearUserConversations(userId: string): number {
  let count = 0;
  for (const [id, conv] of store.entries()) {
    if (conv.userId === userId) {
      store.delete(id);
      count++;
    }
  }
  return count;
}

// ─── TTL cleanup (runs every 30 minutes) ─────────────────────────────────────

setInterval(() => {
  const cutoff = Date.now() - TTL_MS;
  let expired = 0;
  for (const [id, conv] of store.entries()) {
    if (conv.updatedAt.getTime() < cutoff) {
      store.delete(id);
      expired++;
    }
  }
  if (expired > 0) logger.debug(`Conversation TTL cleanup: removed ${expired} expired conversations`);
}, 30 * 60 * 1000);
