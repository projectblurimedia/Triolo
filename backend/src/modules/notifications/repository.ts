import { Pool, QueryResultRow } from 'pg';
import { AppNotification, NotificationListResult, NotificationType, PushApp } from './interfaces';

function mapNotification(row: QueryResultRow): AppNotification {
  return {
    id: row.id,
    accountId: row.account_id,
    type: row.type,
    title: row.title,
    body: row.body,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

export class NotificationsRepository {
  constructor(private readonly pool: Pool) {}

  async create(params: { accountId: string; type: NotificationType; title: string; body: string }): Promise<AppNotification> {
    const result = await this.pool.query(
      `INSERT INTO notifications (account_id, type, title, body) VALUES ($1, $2, $3, $4) RETURNING *`,
      [params.accountId, params.type, params.title, params.body],
    );
    return mapNotification(result.rows[0]);
  }

  async findForAccount(accountId: string, limit: number): Promise<NotificationListResult> {
    const [rows, unread] = await Promise.all([
      this.pool.query(`SELECT * FROM notifications WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2`, [accountId, limit]),
      this.pool.query(`SELECT COUNT(*) FROM notifications WHERE account_id = $1 AND is_read = false`, [accountId]),
    ]);
    return { items: rows.rows.map(mapNotification), unreadCount: Number(unread.rows[0].count) };
  }

  async markRead(accountId: string, id: string): Promise<void> {
    await this.pool.query(`UPDATE notifications SET is_read = true WHERE id = $1 AND account_id = $2`, [id, accountId]);
  }

  async markAllRead(accountId: string): Promise<void> {
    await this.pool.query(`UPDATE notifications SET is_read = true WHERE account_id = $1 AND is_read = false`, [accountId]);
  }

  /** Deletes only the caller's own notifications — ids belonging to anyone else are silently ignored. */
  async deleteMany(accountId: string, ids: string[]): Promise<number> {
    const result = await this.pool.query(`DELETE FROM notifications WHERE account_id = $1 AND id = ANY($2::uuid[])`, [
      accountId,
      ids,
    ]);
    return result.rowCount ?? 0;
  }

  // --- push_tokens — a second table this same module owns (see migrations 0010 and 0026).
  // One row per account per app ('user' / 'partner'; 'legacy' = registered before apps sent it).

  /**
   * This device now belongs to this account in this app. The same device token is removed
   * from every other account first — whoever logged in on the phone last gets its
   * notifications — and a legacy row for it on this account is replaced.
   */
  async upsertPushToken(accountId: string, token: string, app: PushApp): Promise<void> {
    await this.pool.query(`DELETE FROM push_tokens WHERE token = $1 AND NOT (account_id = $2 AND app = $3)`, [
      token,
      accountId,
      app,
    ]);
    await this.pool.query(
      `INSERT INTO push_tokens (account_id, token, app) VALUES ($1, $2, $3)
       ON CONFLICT (account_id, app) DO UPDATE SET token = EXCLUDED.token, updated_at = now()`,
      [accountId, token, app],
    );
  }

  /** Logging out of an app on a phone stops that phone getting this account's notifications. */
  async removePushToken(accountId: string, app: PushApp, token?: string): Promise<void> {
    if (token) {
      await this.pool.query(`DELETE FROM push_tokens WHERE account_id = $1 AND token = $2`, [accountId, token]);
      return;
    }
    await this.pool.query(`DELETE FROM push_tokens WHERE account_id = $1 AND app = $2`, [accountId, app]);
  }

  async findPushTokens(accountId: string): Promise<{ token: string; app: PushApp | 'legacy' }[]> {
    const result = await this.pool.query('SELECT token, app FROM push_tokens WHERE account_id = $1', [accountId]);
    return result.rows.map((row) => ({ token: row.token, app: row.app }));
  }
}
