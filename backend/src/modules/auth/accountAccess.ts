import { pool } from '@/config/database';
import { AppError } from '@/common/errors/AppError';

// Looked up at most every CACHE_MS per account per server instance, so a suspension or ban
// takes effect within seconds on every request — not only when the 15-minute access token
// next refreshes — without a database round trip on every call.
const CACHE_MS = 30_000;

interface Standing {
  status: string;
  deletionRequestedAt: Date | null;
  suspendedUntil: Date | null;
  reason: string | null;
  checkedAt: number;
}

const cache = new Map<string, Standing>();

/** How long a deleted account is kept before its personal details are wiped. */
export const ACCOUNT_KEEP_DAYS = 30;

/** Drop a cached standing (after the admin changes it on this instance). */
export function forgetAccountStanding(accountId: string): void {
  cache.delete(accountId);
}

/** The error a suspended or banned account gets — on login and on every request. */
export function standingError(
  status: string,
  suspendedUntil: Date | null,
  reason: string | null,
  deletionRequestedAt: Date | null = null,
): AppError | null {
  if (deletionRequestedAt) {
    return new AppError(403, 'ACCOUNT_DELETED', 'This account was deleted.', {
      // After this the number is free to sign up again.
      reusableFrom: new Date(deletionRequestedAt.getTime() + ACCOUNT_KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  if (status === 'blocked') {
    return new AppError(403, 'ACCOUNT_BLOCKED', 'This account has been banned.', { reason });
  }
  if (status === 'suspended') {
    return new AppError(403, 'ACCOUNT_SUSPENDED', 'This account is suspended.', {
      until: suspendedUntil ? suspendedUntil.toISOString() : null,
      reason,
    });
  }
  return null;
}

async function load(accountId: string): Promise<Standing | null> {
  const result = await pool.query(
    `UPDATE accounts SET status = 'active', suspended_until = NULL, status_reason = NULL, status_changed_at = now()
     WHERE id = $1 AND status = 'suspended' AND suspended_until IS NOT NULL AND suspended_until <= now()`,
    [accountId],
  );
  void result;
  const row = (
    await pool.query(`SELECT status, suspended_until, status_reason, deletion_requested_at FROM accounts WHERE id = $1`, [accountId])
  ).rows[0];
  if (!row) return null;
  return {
    status: row.status,
    deletionRequestedAt: row.deletion_requested_at ?? null,
    suspendedUntil: row.suspended_until ?? null,
    reason: row.status_reason ?? null,
    checkedAt: Date.now(),
  };
}

/** Rejects a request from a suspended, banned or deleted account. */
export async function assertAccountInGoodStanding(accountId: string): Promise<void> {
  let standing = cache.get(accountId);
  if (!standing || Date.now() - standing.checkedAt > CACHE_MS) {
    const loaded = await load(accountId);
    if (!loaded) throw AppError.unauthorized('Account not found.', 'ACCOUNT_NOT_FOUND');
    standing = loaded;
    cache.set(accountId, standing);
  }
  const error = standingError(standing.status, standing.suspendedUntil, standing.reason, standing.deletionRequestedAt);
  if (error) throw error;
}
