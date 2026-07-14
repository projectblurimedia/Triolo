import { Pool } from 'pg';
import { env } from './env';

// Local Postgres (dev/CI) doesn't use TLS; hosted providers (e.g. Supabase) require it.
const isLocalHost = /(^|@)(localhost|127\.0\.0\.1)(:|\/)/.test(env.databaseUrl);

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: isLocalHost ? undefined : { rejectUnauthorized: false },
});

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
