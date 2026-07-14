import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from '@/common/utils/logger';
import { errorHandler, notFoundHandler } from '@/common/middleware/errorHandler';
import { authRouter } from '@/modules/auth/routes';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(pinoHttp({ logger, autoLogging: process.env.NODE_ENV !== 'test' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ success: true, message: 'OK', data: { status: 'healthy' } });
  });

  app.use('/api/v1/auth', authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
