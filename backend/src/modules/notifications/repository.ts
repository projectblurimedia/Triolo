import { Pool, QueryResultRow } from 'pg';
import { AppNotification, NotificationListResult, NotificationType, PushApp } from './interfaces';

function mapNotification(row: QueryResultRow): AppNotification & { actorAccountId?: string | null; actorName?: string | null; actorMobile?: string | null } {
  return {
    ref: row.ref_kind ? { kind: row.ref_kind, id: row.ref_id ?? null } : null,
    actorAccountId: row.actor_account_id ?? null,
    actorName: row.actor_name ?? null,
    actorMobile: row.actor_mobile ?? null,
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

  async create(params: {
    accountId: string;
    type: NotificationType;
    title: string;
    body: string;
    actorAccountId?: string | null;
    refKind?: string | null;
    refId?: string | null;
  }): Promise<AppNotification> {
    const result = await this.pool.query(
      `INSERT INTO notifications (account_id, type, title, body, actor_account_id, ref_kind, ref_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [params.accountId, params.type, params.title, params.body, params.actorAccountId ?? null, params.refKind ?? null, params.refId ?? null],
    );
    return mapNotification(result.rows[0]);
  }

  async findForAccount(accountId: string, limit: number): Promise<NotificationListResult> {
    const [rows, unread] = await Promise.all([
      // The actor's (viewer's) name is read for display; the service decides who sees it.
      this.pool.query(
        `SELECT n.*, a.full_name AS actor_name, a.mobile_number AS actor_mobile
         FROM notifications n LEFT JOIN accounts a ON a.id = n.actor_account_id
         WHERE n.account_id = $1 ORDER BY n.created_at DESC LIMIT $2`,
        [accountId, limit],
      ),
      this.pool.query(`SELECT COUNT(*) FROM notifications WHERE account_id = $1 AND is_read = false`, [accountId]),
    ]);
    return { items: rows.rows.map(mapNotification), unreadCount: Number(unread.rows[0].count) };
  }

  /** A viewer's name (for a subscribed partner's push). */
  async accountName(accountId: string): Promise<string | null> {
    const result = await this.pool.query(`SELECT full_name FROM accounts WHERE id = $1`, [accountId]);
    return result.rows[0]?.full_name ?? null;
  }

  /** A viewer's name and number (for a job post plan subscriber's push). */
  async accountContact(accountId: string): Promise<{ name: string; mobile: string } | null> {
    const result = await this.pool.query(`SELECT full_name, mobile_number FROM accounts WHERE id = $1`, [accountId]);
    const row = result.rows[0];
    return row ? { name: row.full_name, mobile: row.mobile_number } : null;
  }

  /** Marks read every notification about one thing (e.g. a job post's views, once opened). */
  async markReadByRef(accountId: string, refKind: string, refId: string): Promise<void> {
    await this.pool.query(
      `UPDATE notifications SET is_read = true WHERE account_id = $1 AND ref_kind = $2 AND ref_id = $3 AND is_read = false`,
      [accountId, refKind, refId],
    );
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
  async upsertPushToken(accountId: string, token: string, app: PushApp, fullScreen = false): Promise<void> {
    await this.pool.query(`DELETE FROM push_tokens WHERE token = $1 AND NOT (account_id = $2 AND app = $3)`, [
      token,
      accountId,
      app,
    ]);
    await this.pool.query(
      `INSERT INTO push_tokens (account_id, token, app, full_screen) VALUES ($1, $2, $3, $4)
       ON CONFLICT (account_id, app) DO UPDATE SET token = EXCLUDED.token, full_screen = EXCLUDED.full_screen, updated_at = now()`,
      [accountId, token, app, fullScreen],
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

  async findPushTokens(accountId: string): Promise<{ token: string; app: PushApp | 'legacy'; fullScreen: boolean }[]> {
    const result = await this.pool.query('SELECT token, app, full_screen FROM push_tokens WHERE account_id = $1', [accountId]);
    return result.rows.map((row) => ({ token: row.token, app: row.app, fullScreen: !!row.full_screen }));
  }
}
