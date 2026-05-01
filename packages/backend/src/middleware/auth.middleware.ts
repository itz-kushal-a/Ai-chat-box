import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, ApiResponse } from '../types';
import { AppError } from './error.middleware';

// Extend Express Request to carry the decoded user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ─── Required auth ────────────────────────────────────────────────────────────

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'Missing or malformed Authorization header', 'AUTH_MISSING');
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new AppError(500, 'JWT secret not configured', 'CONFIG_ERROR');
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AppError(401, 'Token has expired', 'AUTH_EXPIRED'));
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return next(new AppError(401, 'Invalid token', 'AUTH_INVALID'));
    }
    next(err);
  }
}

// ─── Optional auth (attaches user if token present, but doesn't block) ────────

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  try {
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (secret) {
      req.user = jwt.verify(token, secret) as JwtPayload;
    }
  } catch {
    // Silently ignore invalid optional tokens
  }
  next();
}

// ─── Plan guard ───────────────────────────────────────────────────────────────

export function requirePlan(plans: ('free' | 'pro' | 'team')[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required', 'AUTH_REQUIRED'));
    }
    if (!plans.includes(req.user.plan)) {
      return next(new AppError(403, `This feature requires a ${plans.join(' or ')} plan`, 'PLAN_REQUIRED'));
    }
    next();
  };
}
