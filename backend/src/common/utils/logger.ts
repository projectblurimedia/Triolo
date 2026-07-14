import pino from 'pino';
import { env } from '@/config/env';

export const logger = pino({
  level: env.isTest ? 'silent' : env.nodeEnv === 'production' ? 'info' : 'debug',
  // Structured JSON is what production log aggregation wants; a human reading a
  // local terminal wants short readable lines instead. Never used for test/prod.
  transport:
    env.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        }
      : undefined,
});
