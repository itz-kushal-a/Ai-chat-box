import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateConfig } from './config';
import apiRouter from './routes/api';
import { globalErrorHandler, notFoundHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/validate.middleware';
import { logger } from './utils/logger';

// Validate config before anything else
validateConfig();

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────

app.use(helmet());

app.use(cors({
  origin:         config.cors.origins,
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Parsing ──────────────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ──────────────────────────────────────────────────────────────────

app.use(requestLogger);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({
    name:    'AI Coding Assistant API',
    version: '1.0.0',
    status:  'running',
    env:     config.nodeEnv,
    docs:    '/api',
  });
});

app.use('/api', apiRouter);

// ─── Error handling (must be last) ───────────────────────────────────────────

app.use(notFoundHandler);
app.use(globalErrorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(config.port, () => {
  logger.info(`Server running on http://localhost:${config.port}`);
  logger.info(`Environment : ${config.nodeEnv}`);
  logger.info(`AI model    : ${config.anthropic.model}`);
  logger.info(`CORS origins: ${config.cors.origins.join(', ')}`);
});

export default app;
