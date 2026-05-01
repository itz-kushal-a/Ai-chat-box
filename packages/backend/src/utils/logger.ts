type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const isDev = process.env.NODE_ENV !== 'production';

function timestamp(): string {
  return new Date().toISOString();
}

function colorize(level: LogLevel, text: string): string {
  if (!isDev) return text;
  const colors: Record<LogLevel, string> = {
    info:  '\x1b[36m',   // cyan
    warn:  '\x1b[33m',   // yellow
    error: '\x1b[31m',   // red
    debug: '\x1b[90m',   // gray
  };
  return `${colors[level]}${text}\x1b[0m`;
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const prefix = colorize(level, `[${level.toUpperCase()}]`);
  const ts = colorize('debug', `[${timestamp()}]`);
  const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
  console.log(`${ts} ${prefix} ${message}${metaStr}`);
}

export const logger = {
  info:  (msg: string, meta?: Record<string, unknown>) => log('info',  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => log('warn',  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => { if (isDev) log('debug', msg, meta); },
};
