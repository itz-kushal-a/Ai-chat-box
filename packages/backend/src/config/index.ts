import dotenv from 'dotenv';
dotenv.config();

// ─── Env helper ───────────────────────────────────────────────────────────────

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function optionalNumber(key: string, fallback: number): number {
  const val = process.env[key];
  const parsed = val ? parseInt(val, 10) : NaN;
  return isNaN(parsed) ? fallback : parsed;
}

// ─── Config object ────────────────────────────────────────────────────────────

export const config = {
  // Server
  port:     optionalNumber('PORT', 4000),
  nodeEnv:  optional('NODE_ENV', 'development'),
  isDev:    optional('NODE_ENV', 'development') === 'development',
  isProd:   optional('NODE_ENV', 'development') === 'production',

  // Auth
  jwt: {
    secret:           optional('JWT_SECRET', 'dev-secret-change-in-production'),
    expiresIn:        optional('JWT_EXPIRES_IN', '15m'),
    refreshExpiresIn: optional('REFRESH_TOKEN_EXPIRES_IN', '7d'),
  },

  // Anthropic AI
  anthropic: {
    apiKey:        optional('ANTHROPIC_API_KEY', ''),
    model:         optional('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514'),
    maxTokens:     optionalNumber('ANTHROPIC_MAX_TOKENS', 1000),
    maxRetries:    optionalNumber('ANTHROPIC_MAX_RETRIES', 3),
    retryDelayMs:  optionalNumber('ANTHROPIC_RETRY_DELAY_MS', 1000),
    timeoutMs:     optionalNumber('ANTHROPIC_TIMEOUT_MS', 30000),
  },

  // CORS
  cors: {
    origins: optional('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000')
      .split(',')
      .map(o => o.trim()),
  },

  // Rate limits
  rateLimit: {
    apiPerMinute:      optionalNumber('RATE_LIMIT_API', 60),
    aiPerMinute:       optionalNumber('RATE_LIMIT_AI', 10),
    generatePerMinute: optionalNumber('RATE_LIMIT_GENERATE', 3),
  },

  // Token plan limits
  plans: {
    free: optionalNumber('PLAN_FREE_TOKENS',  100_000),
    pro:  optionalNumber('PLAN_PRO_TOKENS',   500_000),
    team: optionalNumber('PLAN_TEAM_TOKENS', 2_000_000),
  },
};

// ─── Validate critical config on startup ──────────────────────────────────────

export function validateConfig(): void {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!process.env.ANTHROPIC_API_KEY) {
    errors.push('ANTHROPIC_API_KEY is not set — AI routes will fail');
  }

  if (config.jwt.secret === 'dev-secret-change-in-production' && config.isProd) {
    errors.push('JWT_SECRET must be changed in production');
  }

  if (config.jwt.secret === 'dev-secret-change-in-production' && config.isDev) {
    warnings.push('Using default JWT_SECRET — set a real value in .env');
  }

  warnings.forEach(w => console.warn(`[config] ⚠  ${w}`));

  if (errors.length > 0) {
    if (config.isProd) {
      throw new Error(`Configuration errors:\n${errors.join('\n')}`);
    } else {
      errors.forEach(e => console.error(`[config] ✖  ${e}`));
    }
  }
}

export type Config = typeof config;
