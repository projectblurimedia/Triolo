import { Pool } from 'pg';
import { FavoriteTargetType } from './interfaces';

export class FavoritesRepository {
  constructor(private readonly pool: Pool) {}

  async add(accountId: string, targetType: FavoriteTargetType, targetId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO favorites (account_id, target_type, target_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [accountId, targetType, targetId],
    );
  }

  async remove(accountId: string, targetType: FavoriteTargetType, targetId: string): Promise<void> {
    await this.pool.query(`DELETE FROM favorites WHERE account_id = $1 AND target_type = $2 AND target_id = $3`, [
      accountId,
      targetType,
      targetId,
    ]);
  }

  /** Newest first. */
  async listIds(accountId: string, targetType: FavoriteTargetType): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT target_id FROM favorites WHERE account_id = $1 AND target_type = $2 ORDER BY created_at DESC`,
      [accountId, targetType],
    );
    return result.rows.map((row) => row.target_id);
  }
}
