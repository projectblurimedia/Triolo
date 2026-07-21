import { Pool } from 'pg';
import { env } from './env';
import { logger } from '@/common/utils/logger';

// Local Postgres (dev/CI) doesn't use TLS; hosted providers (e.g. Supabase) require it.
const isLocalHost = /(^|@)(localhost|127\.0\.0\.1)(:|\/)/.test(env.databaseUrl);

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: isLocalHost ? undefined : { rejectUnauthorized: false },
});

// pg's Pool emits 'error' on idle clients (e.g. Supabase resetting idle connections) —
// left unhandled, Node treats it as an unhandled 'error' event and crashes the whole
// process, killing every in-flight request. A pooled connection dying is routine, not fatal.
pool.on('error', (err) => {
  logger.error(err, 'Unexpected error on idle Postgres client');
});

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

/**
 * Non-fatal on purpose: the server should still boot and serve /health even if
 * the database is unreachable (e.g. the CI boot smoke test uses a placeholder
 * DATABASE_URL with no real Postgres behind it). Callers just get a clear
 * connected/failed log line instead of a silent lazy-connect on first query.
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
