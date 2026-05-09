import dotenv from 'dotenv';
dotenv.config();

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  if (!val) return fallback;
  const parsed = parseInt(val, 10);
  if (isNaN(parsed)) throw new Error(`Environment variable ${key} must be a number, got: "${val}"`);
  return parsed;
}

function optionalBoolean(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (!val) return fallback;
  return val.toLowerCase() === 'true';
}

// ─── Config object ────────────────────────────────────────────────────────────

export const config = {
  // Server
  port:     optionalNumber('PORT', 4000),
  nodeEnv:  optional('NODE_ENV', 'development'),
  isDev:    optional('NODE_ENV', 'development') === 'development',
  isProd:   optional('NODE_ENV', 'development') === 'production',

  // Auth
  jwtSecret:            optional('JWT_SECRET', 'dev-secret-change-in-production'),
  jwtExpiresIn:         optional('JWT_EXPIRES_IN', '15m'),
  refreshTokenExpires:  optional('REFRESH_TOKEN_EXPIRES_IN', '7d'),

  // Anthropic AI
  anthropic: {
    apiKey:        optional('ANTHROPIC_API_KEY', ''),
    model:         optional('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514'),
    maxTokens:     optionalNumber('ANTHROPIC_MAX_TOKENS', 1000),
    maxRetries:    optionalNumber('ANTHROPIC_MAX_RETRIES', 3),
    retryDelayMs:  optionalNumber('ANTHROPIC_RETRY_DELAY_MS', 1000),
    timeoutMs:     optionalNumber('ANTHROPIC_TIMEOUT_MS', 30000),
    streamEnabled: optionalBoolean('ANTHROPIC_STREAM_ENABLED', true),
  },

  // Rate limits
  rateLimit: {
    api:      optionalNumber('RATE_LIMIT_API',      60),
    ai:       optionalNumber('RATE_LIMIT_AI',       10),
    strict:   optionalNumber('RATE_LIMIT_STRICT',    3),
    windowMs: optionalNumber('RATE_LIMIT_WINDOW_MS', 60_000),
  },

  // CORS
  allowedOrigins: optional(
    'ALLOWED_ORIGINS',
    'http://localhost:5173,http://localhost:3000',
  ).split(',').map(s => s.trim()),

  // Token plan limits
  tokenLimits: {
    free: optionalNumber('TOKEN_LIMIT_FREE',  100_000),
    pro:  optionalNumber('TOKEN_LIMIT_PRO',   500_000),
    team: optionalNumber('TOKEN_LIMIT_TEAM', 2_000_000),
  },

  // Logging
  logLevel: optional('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error',
} as const;

// ─── Startup validation ───────────────────────────────────────────────────────

export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.anthropic.apiKey) {
    errors.push('ANTHROPIC_API_KEY is required');
  } else if (!config.anthropic.apiKey.startsWith('sk-ant-')) {
    errors.push('ANTHROPIC_API_KEY appears to be invalid (should start with sk-ant-)');
  }

  if (config.isProd && config.jwtSecret === 'dev-secret-change-in-production') {
    errors.push('JWT_SECRET must be set in production');
  }

  if (config.anthropic.maxTokens < 100 || config.anthropic.maxTokens > 8096) {
    errors.push('ANTHROPIC_MAX_TOKENS must be between 100 and 8096');
  }

  if (errors.length > 0) {
    console.error('\n❌ Configuration errors:\n' + errors.map(e => `  - ${e}`).join('\n') + '\n');
    process.exit(1);
  }

  console.log('✅ Config validated');
}
