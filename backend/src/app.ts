import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from '@/common/utils/logger';
import { errorHandler, notFoundHandler } from '@/common/middleware/errorHandler';
import { authRouter } from '@/modules/auth/routes';
import { workersRouter } from '@/modules/workers/routes';
import { businessesRouter } from '@/modules/businesses/routes';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(
    pinoHttp({
      logger,
      autoLogging: process.env.NODE_ENV !== 'test',
      customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
      customErrorMessage: (req, res, err) => `${req.method} ${req.url} -> ${res.statusCode} (${err.message})`,
      // The success/error message above already has method/url/status. The default req/res
      // objects would otherwise dump every header — including Authorization, which must
      // never be logged (see .cloud/development-rules.md) — so drop them entirely.
      serializers: {
        req: () => undefined,
        res: () => undefined,
      },
    }),
  );

  app.get('/health', (_req, res) => {
    res.status(200).json({ success: true, message: 'OK', data: { status: 'healthy' } });
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/workers', workersRouter);
  app.use('/api/v1/businesses', businessesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
