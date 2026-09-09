import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from '@/common/utils/logger';
import { errorHandler, notFoundHandler } from '@/common/middleware/errorHandler';
import { authRouter } from '@/modules/auth/routes';
import { workersRouter } from '@/modules/workers/routes';
import { businessesRouter } from '@/modules/businesses/routes';
import { adminRouter } from '@/modules/admin/routes';

export function createApp(): Express {
  const app = express();

  // Behind a reverse proxy (Vercel's edge network) in every deployed environment — without
  // this, Express ignores the `X-Forwarded-For` header entirely, and express-rate-limit
  // (see routes using rateLimiter.ts) falls back to keying every request off the proxy's
  // own IP instead of the real client, logging a warning and making per-IP rate limits
  // meaningless (everyone behind the proxy shares one bucket). `1` trusts exactly one hop
  // (Vercel's own edge), not an attacker-supplied chain further back. Harmless locally —
  // there's no proxy in front there, so the header is simply absent.
  app.set('trust proxy', 1);

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
  app.use('/api/v1/admin', adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
