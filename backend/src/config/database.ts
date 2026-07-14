import { Pool } from 'pg';
import { env } from './env';

export const pool = new Pool({
  connectionString: env.databaseUrl,
});

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
