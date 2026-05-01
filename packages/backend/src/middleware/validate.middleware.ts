import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';
import { ValidationError } from '../types';

// ─── Validation helpers ───────────────────────────────────────────────────────

function isString(val: unknown): val is string {
  return typeof val === 'string';
}

function isNonEmptyString(val: unknown): val is string {
  return isString(val) && val.trim().length > 0;
}

function isBoolean(val: unknown): val is boolean {
  return typeof val === 'boolean';
}

function isWithin(val: string, maxLength: number): boolean {
  return val.length <= maxLength;
}

// ─── Generic validator ────────────────────────────────────────────────────────

function validate(errors: ValidationError[], next: NextFunction): boolean {
  if (errors.length > 0) {
    next(new AppError(400, errors.map(e => `${e.field}: ${e.message}`).join('; '), 'VALIDATION_ERROR'));
    return false;
  }
  return true;
}

// ─── /chat validator ──────────────────────────────────────────────────────────

export function validateChat(req: Request, _res: Response, next: NextFunction) {
  const errors: ValidationError[] = [];
  const { message, history, selectedCode, filePath, stream } = req.body;

  if (!isNonEmptyString(message)) {
    errors.push({ field: 'message', message: 'Required, must be a non-empty string' });
  } else if (!isWithin(message, 4000)) {
    errors.push({ field: 'message', message: 'Must be 4000 characters or fewer' });
  }

  if (history !== undefined) {
    if (!Array.isArray(history)) {
      errors.push({ field: 'history', message: 'Must be an array of messages' });
    } else if (history.length > 50) {
      errors.push({ field: 'history', message: 'Maximum 50 messages in history' });
    } else {
      history.forEach((msg: unknown, i: number) => {
        if (typeof msg !== 'object' || msg === null) {
          errors.push({ field: `history[${i}]`, message: 'Each message must be an object' });
        } else {
          const m = msg as Record<string, unknown>;
          if (!['user', 'assistant', 'system'].includes(m.role as string)) {
            errors.push({ field: `history[${i}].role`, message: 'Must be user, assistant, or system' });
          }
          if (!isNonEmptyString(m.content)) {
            errors.push({ field: `history[${i}].content`, message: 'Must be a non-empty string' });
          }
        }
      });
    }
  }

  if (selectedCode !== undefined && !isString(selectedCode)) {
    errors.push({ field: 'selectedCode', message: 'Must be a string' });
  } else if (selectedCode && !isWithin(selectedCode, 8000)) {
    errors.push({ field: 'selectedCode', message: 'Must be 8000 characters or fewer' });
  }

  if (filePath !== undefined && !isString(filePath)) {
    errors.push({ field: 'filePath', message: 'Must be a string' });
  }

  if (stream !== undefined && !isBoolean(stream)) {
    errors.push({ field: 'stream', message: 'Must be a boolean' });
  }

  if (validate(errors, next)) next();
}

// ─── /explain-code validator ──────────────────────────────────────────────────

export function validateExplainCode(req: Request, _res: Response, next: NextFunction) {
  const errors: ValidationError[] = [];
  const { code, language, filePath, detail } = req.body;

  if (!isNonEmptyString(code)) {
    errors.push({ field: 'code', message: 'Required, must be a non-empty string' });
  } else if (!isWithin(code, 10000)) {
    errors.push({ field: 'code', message: 'Must be 10,000 characters or fewer' });
  }

  if (language !== undefined && !isNonEmptyString(language)) {
    errors.push({ field: 'language', message: 'Must be a non-empty string' });
  }

  if (filePath !== undefined && !isString(filePath)) {
    errors.push({ field: 'filePath', message: 'Must be a string' });
  }

  if (detail !== undefined && !['brief', 'full'].includes(detail)) {
    errors.push({ field: 'detail', message: 'Must be "brief" or "full"' });
  }

  if (validate(errors, next)) next();
}

// ─── /fix-code validator ──────────────────────────────────────────────────────

export function validateFixCode(req: Request, _res: Response, next: NextFunction) {
  const errors: ValidationError[] = [];
  const { code, error: codeError, language, filePath, instructions } = req.body;

  if (!isNonEmptyString(code)) {
    errors.push({ field: 'code', message: 'Required, must be a non-empty string' });
  } else if (!isWithin(code, 10000)) {
    errors.push({ field: 'code', message: 'Must be 10,000 characters or fewer' });
  }

  if (codeError !== undefined && !isString(codeError)) {
    errors.push({ field: 'error', message: 'Must be a string' });
  }

  if (language !== undefined && !isNonEmptyString(language)) {
    errors.push({ field: 'language', message: 'Must be a non-empty string' });
  }

  if (filePath !== undefined && !isString(filePath)) {
    errors.push({ field: 'filePath', message: 'Must be a string' });
  }

  if (instructions !== undefined && !isString(instructions)) {
    errors.push({ field: 'instructions', message: 'Must be a string' });
  } else if (instructions && !isWithin(instructions, 1000)) {
    errors.push({ field: 'instructions', message: 'Must be 1000 characters or fewer' });
  }

  if (validate(errors, next)) next();
}

// ─── /generate-code validator ─────────────────────────────────────────────────

const VALID_TARGETS = ['component', 'route', 'function', 'test', 'type', 'utility'];

export function validateGenerateCode(req: Request, _res: Response, next: NextFunction) {
  const errors: ValidationError[] = [];
  const { prompt, target, language, framework, context } = req.body;

  if (!isNonEmptyString(prompt)) {
    errors.push({ field: 'prompt', message: 'Required, must be a non-empty string' });
  } else if (!isWithin(prompt, 2000)) {
    errors.push({ field: 'prompt', message: 'Must be 2000 characters or fewer' });
  }

  if (!isNonEmptyString(target) || !VALID_TARGETS.includes(target)) {
    errors.push({ field: 'target', message: `Required. Must be one of: ${VALID_TARGETS.join(', ')}` });
  }

  if (language !== undefined && !isNonEmptyString(language)) {
    errors.push({ field: 'language', message: 'Must be a non-empty string' });
  }

  if (framework !== undefined && !isString(framework)) {
    errors.push({ field: 'framework', message: 'Must be a string' });
  }

  if (context !== undefined && !isString(context)) {
    errors.push({ field: 'context', message: 'Must be a string' });
  } else if (context && !isWithin(context, 5000)) {
    errors.push({ field: 'context', message: 'Must be 5000 characters or fewer' });
  }

  if (validate(errors, next)) next();
}

// ─── Request logger middleware ────────────────────────────────────────────────

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const user = req.user?.userId ?? 'anon';
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${ms}ms user=${user}`);
  });
  next();
}
