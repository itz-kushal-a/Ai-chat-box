import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import apiRouter from './routes/api';
import { globalErrorHandler, notFoundHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/validate.middleware';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT ?? 4000;

// ─── Security middleware ──────────────────────────────────────────────────────

app.use(helmet());

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [
    'http://localhost:5173',  // Frontend (Vite)
    'http://localhost:3000',  // Alternative frontend port
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body parsing ─────────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request logging ──────────────────────────────────────────────────────────

app.use(requestLogger);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({
    name:    'AI Coding Assistant API',
    version: '1.0.0',
    status:  'running',
    docs:    '/api',
  });
});

app.use('/api', apiRouter);

// ─── Error handling ───────────────────────────────────────────────────────────

// 404 for any unmatched routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(globalErrorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
  logger.info('Routes mounted:', {
    routes: [
      'POST /api/chat',
      'POST /api/explain-code',
      'POST /api/fix-code',
      'POST /api/generate-code',
    ],
  });
});

export default app;
