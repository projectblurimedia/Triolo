import { Pool, QueryResultRow } from 'pg';
import { AppNotification, NotificationListResult, NotificationType } from './interfaces';

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
      this.pool.query(`SELECT * FROM notifications WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2`, [
        accountId,
        limit,
      ]),
      this.pool.query(`SELECT COUNT(*) FROM notifications WHERE account_id = $1 AND is_read = false`, [accountId]),
    ]);
    return { items: rows.rows.map(mapNotification), unreadCount: Number(unread.rows[0].count) };
  }

  async markRead(accountId: string, id: string): Promise<void> {
    await this.pool.query(`UPDATE notifications SET is_read = true WHERE id = $1 AND account_id = $2`, [id, accountId]);
  }

  async markAllRead(accountId: string): Promise<void> {
    await this.pool.query(`UPDATE notifications SET is_read = true WHERE account_id = $1 AND is_read = false`, [
      accountId,
    ]);
  }
}
