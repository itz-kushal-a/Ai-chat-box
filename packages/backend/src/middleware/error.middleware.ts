import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

// ─── Custom error class ───────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── 404 handler ─────────────────────────────────────────────────────────────

export function notFoundHandler(req: Request, res: Response) {
  const response: ApiResponse = {
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  };
  res.status(404).json(response);
}

// ─── Global error handler ─────────────────────────────────────────────────────

export function globalErrorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  // Anthropic API errors
  if (err.message?.includes('overloaded') || err.message?.includes('rate_limit')) {
    logger.warn('AI service rate limit hit', { path: req.path });
    const response: ApiResponse = { success: false, error: 'AI service is busy. Please try again in a moment.' };
    return res.status(429).json(response);
  }

  // Known app errors
  if (err instanceof AppError) {
    logger.warn('App error', { code: err.code, status: err.statusCode, message: err.message });
    const response: ApiResponse = { success: false, error: err.message };
    return res.status(err.statusCode).json(response);
  }

  // Unknown errors
  logger.error('Unhandled error', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  const response: ApiResponse = {
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  };
  return res.status(500).json(response);
}
