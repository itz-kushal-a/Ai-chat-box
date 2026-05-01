import { logger } from '../utils/logger';

// ─── In-memory token tracker (use DB in production) ───────────────────────────

interface UserUsage {
  userId: string;
  plan: 'free' | 'pro' | 'team';
  tokensUsed: number;
  resetAt: number; // monthly reset
}

const PLAN_LIMITS: Record<string, number> = {
  free: 100_000,
  pro:  500_000,
  team: 2_000_000,
};

const usageStore = new Map<string, UserUsage>();

// ─── Get or initialise usage record ──────────────────────────────────────────

function getUsage(userId: string, plan: 'free' | 'pro' | 'team'): UserUsage {
  const now = Date.now();
  const existing = usageStore.get(userId);

  // Reset monthly counters
  if (!existing || existing.resetAt < now) {
    const resetAt = getNextMonthReset();
    const record: UserUsage = { userId, plan, tokensUsed: 0, resetAt };
    usageStore.set(userId, record);
    return record;
  }

  return existing;
}

function getNextMonthReset(): number {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ─── Check if user has tokens remaining ───────────────────────────────────────

export function hasTokenBudget(userId: string, plan: 'free' | 'pro' | 'team'): boolean {
  const usage = getUsage(userId, plan);
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  return usage.tokensUsed < limit;
}

// ─── Record token usage after a successful AI call ────────────────────────────

export function recordUsage(
  userId: string,
  plan: 'free' | 'pro' | 'team',
  promptTokens: number,
  completionTokens: number,
): void {
  const usage = getUsage(userId, plan);
  usage.tokensUsed += promptTokens + completionTokens;

  logger.debug('Token usage recorded', {
    userId,
    added: promptTokens + completionTokens,
    total: usage.tokensUsed,
    limit: PLAN_LIMITS[plan],
  });
}

// ─── Get current usage stats ──────────────────────────────────────────────────

export function getUsageStats(userId: string, plan: 'free' | 'pro' | 'team') {
  const usage = getUsage(userId, plan);
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  return {
    tokensUsed:      usage.tokensUsed,
    tokensLimit:     limit,
    tokensRemaining: Math.max(0, limit - usage.tokensUsed),
    percentUsed:     Math.round((usage.tokensUsed / limit) * 100),
    resetAt:         new Date(usage.resetAt).toISOString(),
  };
}
