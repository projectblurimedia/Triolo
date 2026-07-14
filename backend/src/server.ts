import { createApp } from './app';
import { env } from './config/env';
import { checkDatabaseConnection } from './config/database';
import { logger } from './common/utils/logger';

const app = createApp();

app.listen(env.port, () => {
  logger.info(`Server listening on port ${env.port} [${env.nodeEnv}]`);
});

checkDatabaseConnection().then((connected) => {
  if (connected) {
    logger.info('Database connected');
  } else {
    logger.error('Database connection failed — API routes that touch the database will fail until this is fixed');
  }
});
