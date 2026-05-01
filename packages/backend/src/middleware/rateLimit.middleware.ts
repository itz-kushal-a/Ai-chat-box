import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';

// ─── In-memory store (use Redis in production) ────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

function getKey(req: Request, prefix: string): string {
  // Use authenticated user ID if available, otherwise fall back to IP
  const id = req.user?.userId ?? req.ip ?? 'anonymous';
  return `${prefix}:${id}`;
}

function checkLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// ─── Rate limiter factory ─────────────────────────────────────────────────────

export function rateLimit(options: {
  limit: number;
  windowMs: number;
  prefix?: string;
  message?: string;
}) {
  const { limit, windowMs, prefix = 'rl', message = 'Too many requests. Please slow down.' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = getKey(req, prefix);
    const result = checkLimit(key, limit, windowMs);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000));
      return next(new AppError(429, message, 'RATE_LIMITED'));
    }
    next();
  };
}

// ─── Preset limiters ──────────────────────────────────────────────────────────

// General API: 60 requests per minute
export const apiLimiter = rateLimit({
  limit: 60,
  windowMs: 60 * 1000,
  prefix: 'api',
  message: 'Too many requests. Limit: 60 per minute.',
});

// AI endpoints: 10 requests per minute
export const aiLimiter = rateLimit({
  limit: 10,
  windowMs: 60 * 1000,
  prefix: 'ai',
  message: 'AI rate limit exceeded. Limit: 10 requests per minute.',
});

// Strict limiter for expensive operations: 3 per minute
export const strictLimiter = rateLimit({
  limit: 3,
  windowMs: 60 * 1000,
  prefix: 'strict',
  message: 'Too many requests for this operation. Please wait before trying again.',
});

// Cleanup old entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);
