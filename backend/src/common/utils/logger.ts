import pino from 'pino';
import { env } from '@/config/env';

export const logger = pino({
  level: env.isTest ? 'silent' : env.nodeEnv === 'production' ? 'info' : 'debug',
});
