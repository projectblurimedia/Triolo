import { Pool } from 'pg';
import { parsePgArray } from '@/common/utils/pgArray';
import {
  AdminJobSeekerListFilter,
  AdminJobSeekerPost,
  JobSeekerPost,
  JobPostViewer,
  JobSeekerSearchParams,
  JobSeekerSearchResult,
  SaveJobSeekerPostParams,
} from './interfaces';

// Great-circle distance in metres, same formula as the workers/problems repositories.
// $1/$2 are the searcher's latitude/longitude.
const DISTANCE_SQL = `(6371000 * acos(LEAST(1.0, GREATEST(-1.0,
  cos(radians($1)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians($2)) + sin(radians($1)) * sin(radians(p.latitude))
))))`;

// Visits to post p the poster hasn't opened yet.
const NEW_VIEWS_SQL = `(SELECT COUNT(*) FROM job_post_views v WHERE v.post_id = p.id AND v.seen_at IS NULL)`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPost(row: any): JobSeekerPost {
  return {
    id: row.id,
    viewCount: Number(row.view_count ?? 0),
    ...(row.new_views !== undefined ? { newViews: Number(row.new_views ?? 0) } : {}),
    accountId: row.account_id,
    category: row.category,
    title: row.title,
    payAmount: Number(row.pay_amount),
    payPeriod: row.pay_period,
    availability: row.availability,
    experienceYears: Number(row.experience_years),
    skills: parsePgArray(row.skills),
    description: row.description,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    locationAddress: row.location_address,
    photoUrl: row.photo_url ?? null,
    isActive: row.is_active,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class JobSeekersRepository {
  constructor(private readonly pool: Pool) {}

  /** The account's first post (its oldest), or null. */
  async findByAccount(accountId: string): Promise<JobSeekerPost | null> {
    const result = await this.pool.query(
      `SELECT * FROM job_seeker_posts WHERE account_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [accountId],
    );
    return result.rows[0] ? mapPost(result.rows[0]) : null;
  }

  /** All of the account's posts, oldest first. */
  async listByAccount(accountId: string): Promise<JobSeekerPost[]> {
    const result = await this.pool.query(
      `SELECT p.*, ${NEW_VIEWS_SQL} AS new_views FROM job_seeker_posts p WHERE p.account_id = $1 ORDER BY p.created_at ASC`,
      [accountId],
    );
    return result.rows.map(mapPost);
  }

  /** One of the account's own posts, or null. */
  async findOwned(accountId: string, id: string): Promise<JobSeekerPost | null> {
    const result = await this.pool.query(
      `SELECT p.*, ${NEW_VIEWS_SQL} AS new_views FROM job_seeker_posts p WHERE p.id = $1 AND p.account_id = $2`,
      [id, accountId],
    );
    return result.rows[0] ? mapPost(result.rows[0]) : null;
  }

  async countByAccount(accountId: string): Promise<number> {
    const result = await this.pool.query(`SELECT COUNT(*)::int AS n FROM job_seeker_posts WHERE account_id = $1`, [accountId]);
    return Number(result.rows[0]?.n ?? 0);
  }

  private values(params: SaveJobSeekerPostParams) {
    return [
      params.category,
      params.title,
      params.payAmount,
      params.payPeriod,
      params.availability,
      params.experienceYears,
      params.skills,
      params.description ?? null,
      params.latitude,
      params.longitude,
      params.locationAddress,
    ];
  }

  /** A new post (shown at once). */
  async create(accountId: string, params: SaveJobSeekerPostParams): Promise<JobSeekerPost> {
    const result = await this.pool.query(
      `INSERT INTO job_seeker_posts
         (account_id, category, title, pay_amount, pay_period, availability, experience_years, skills,
          description, latitude, longitude, location_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [accountId, ...this.values(params)],
    );
    return mapPost(result.rows[0]);
  }

  /** Replaces one own post's details (keeping it shown / hidden as it was); null if not theirs. */
  async update(accountId: string, id: string, params: SaveJobSeekerPostParams): Promise<JobSeekerPost | null> {
    const result = await this.pool.query(
      `UPDATE job_seeker_posts SET
         category = $3, title = $4, pay_amount = $5, pay_period = $6, availability = $7,
         experience_years = $8, skills = $9, description = $10, latitude = $11, longitude = $12,
         location_address = $13, updated_at = now()
       WHERE id = $1 AND account_id = $2
       RETURNING *`,
      [id, accountId, ...this.values(params)],
    );
    return result.rows[0] ? mapPost(result.rows[0]) : null;
  }

  async setActive(accountId: string, id: string, isActive: boolean): Promise<JobSeekerPost | null> {
    const result = await this.pool.query(
      `UPDATE job_seeker_posts SET is_active = $3, updated_at = now() WHERE id = $1 AND account_id = $2 RETURNING *`,
      [id, accountId, isActive],
    );
    return result.rows[0] ? mapPost(result.rows[0]) : null;
  }

  /** Sets (or clears) one post's photo; returns the post and the photo it replaced, or null. */
  async setPhoto(
    accountId: string,
    id: string,
    photoUrl: string | null,
  ): Promise<{ post: JobSeekerPost; previousUrl: string | null } | null> {
    const result = await this.pool.query(
      `UPDATE job_seeker_posts p SET photo_url = $3, updated_at = now()
       FROM (SELECT photo_url AS previous_url FROM job_seeker_posts WHERE id = $1 AND account_id = $2 FOR UPDATE) old
       WHERE p.id = $1 AND p.account_id = $2
       RETURNING p.*, old.previous_url`,
      [id, accountId, photoUrl],
    );
    if (!result.rows[0]) return null;
    return { post: mapPost(result.rows[0]), previousUrl: result.rows[0].previous_url ?? null };
  }

  /** Deletes one own post; returns its photo URL so the caller can remove it from storage. */
  async delete(accountId: string, id: string): Promise<{ photoUrl: string | null } | null> {
    const result = await this.pool.query(
      `DELETE FROM job_seeker_posts WHERE id = $1 AND account_id = $2 RETURNING photo_url`,
      [id, accountId],
    );
    return result.rows[0] ? { photoUrl: result.rows[0].photo_url ?? null } : null;
  }

  /**
   * A customer opened a live post (not their own): one more visit, remembered with who it was.
   * Returns the post's owner and title, and whether this viewer hadn't opened it in the last day
   * (so the poster is told once a day per person, not on every open). Null when nothing counted.
   */
  async recordView(
    id: string,
    viewerAccountId: string,
  ): Promise<{ ownerAccountId: string; title: string; firstToday: boolean } | null> {
    const result = await this.pool.query(
      `WITH post AS (
         UPDATE job_seeker_posts SET view_count = view_count + 1
         WHERE id = $1 AND account_id <> $2 AND is_active
         RETURNING id, account_id, title
       ), recent AS (
         SELECT 1 FROM job_post_views WHERE post_id = $1 AND viewer_account_id = $2 AND created_at > now() - interval '1 day' LIMIT 1
       ), added AS (
         INSERT INTO job_post_views (post_id, viewer_account_id) SELECT id, $2 FROM post RETURNING id
       )
       SELECT post.account_id, post.title, NOT EXISTS (SELECT 1 FROM recent) AS first_today, (SELECT count(*) FROM added) AS added
       FROM post`,
      [id, viewerAccountId],
    );
    const row = result.rows[0];
    return row ? { ownerAccountId: row.account_id, title: row.title, firstToday: row.first_today } : null;
  }

  /** Who opened one of the account's posts — one row per person, latest first. */
  async listViewers(ownerAccountId: string, postId: string, limit = 100): Promise<JobPostViewer[] | null> {
    const owned = await this.pool.query(`SELECT 1 FROM job_seeker_posts WHERE id = $1 AND account_id = $2`, [postId, ownerAccountId]);
    if (!owned.rowCount) return null;
    const result = await this.pool.query(
      `SELECT v.viewer_account_id, max(v.created_at) AS last_viewed_at, count(*)::int AS times,
              bool_or(v.seen_at IS NULL) AS is_new, a.full_name, a.mobile_number
       FROM job_post_views v JOIN accounts a ON a.id = v.viewer_account_id
       WHERE v.post_id = $1
       GROUP BY v.viewer_account_id, a.full_name, a.mobile_number
       ORDER BY max(v.created_at) DESC LIMIT $2`,
      [postId, limit],
    );
    return result.rows.map((row) => ({
      viewerKey: row.viewer_account_id,
      name: row.full_name,
      mobile: row.mobile_number,
      lastViewedAt: new Date(row.last_viewed_at).toISOString(),
      times: Number(row.times),
      isNew: row.is_new,
    }));
  }

  /** The poster opened the post's views: none of them are new any more. */
  async markViewsSeen(ownerAccountId: string, postId: string): Promise<void> {
    await this.pool.query(
      `UPDATE job_post_views v SET seen_at = now()
       FROM job_seeker_posts p
       WHERE v.post_id = p.id AND p.id = $1 AND p.account_id = $2 AND v.seen_at IS NULL`,
      [postId, ownerAccountId],
    );
  }

  /** Deletes every post of an account (the admin removing its profiles); returns their photos. */
  async deleteAllForAccount(accountId: string): Promise<(string | null)[]> {
    const result = await this.pool.query(`DELETE FROM job_seeker_posts WHERE account_id = $1 RETURNING photo_url`, [accountId]);
    return result.rows.map((row) => row.photo_url ?? null);
  }

  /**
   * Shown posts within the radius, never the searcher's own. Joins `accounts` only to show who
   * posted and their phone — reading for display, the same way bookings joins worker profiles.
   */
  async search(excludeAccountId: string, params: JobSeekerSearchParams): Promise<JobSeekerSearchResult[]> {
    const values: unknown[] = [params.latitude, params.longitude, excludeAccountId, params.radiusKm * 1000];
    const filters: string[] = [];
    if (params.category) {
      values.push(params.category);
      filters.push(`p.category = $${values.length}`);
    }
    if (params.payPeriod) {
      values.push(params.payPeriod);
      filters.push(`p.pay_period = $${values.length}`);
    }
    if (params.availability) {
      values.push(params.availability);
      filters.push(`p.availability = $${values.length}`);
    }
    if (params.query) {
      values.push(`%${params.query}%`);
      const i = values.length;
      filters.push(
        `(p.title ILIKE $${i} OR p.category::text ILIKE $${i} OR a.full_name ILIKE $${i} OR p.description ILIKE $${i} OR array_to_string(p.skills, ' ') ILIKE $${i})`,
      );
    }
    values.push(params.limit);
    const limitIndex = values.length;
    values.push(params.priorityAccountIds ?? []);
    const priorityIndex = values.length;
    // Sorting by pay compares like with like: a daily rate as roughly 26 working days a month.
    const order =
      params.sort === 'pay'
        ? `(CASE WHEN pay_period = 'daily' THEN pay_amount * 26 ELSE pay_amount END) ASC, distance_meters ASC`
        : `distance_meters ASC, updated_at DESC`;

    const result = await this.pool.query(
      `SELECT * FROM (
         SELECT p.*, a.full_name, a.mobile_number, ${DISTANCE_SQL} AS distance_meters
         FROM job_seeker_posts p
         JOIN accounts a ON a.id = p.account_id
         WHERE p.is_active AND a.status = 'active' AND p.account_id != $3
           ${filters.map((filter) => `AND ${filter}`).join(' ')}
       ) sub
       WHERE distance_meters <= $4
       ORDER BY (account_id = ANY($${priorityIndex}::uuid[])) DESC, ${order}
       LIMIT $${limitIndex}`,
      values,
    );
    return result.rows.map((row) => ({
      ...mapPost(row),
      fullName: row.full_name,
      mobileNumber: row.mobile_number,
      distanceMeters: Number(row.distance_meters),
    }));
  }

  // --- Admin ---

  async adminList(
    filter: AdminJobSeekerListFilter,
  ): Promise<{ items: AdminJobSeekerPost[]; total: number; page: number; limit: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filter.active !== undefined) {
      values.push(filter.active);
      conditions.push(`p.is_active = $${values.length}`);
    }
    if (filter.q) {
      values.push(`%${filter.q}%`);
      const i = values.length;
      conditions.push(
        `(a.full_name ILIKE $${i} OR a.mobile_number ILIKE $${i} OR p.title ILIKE $${i} OR p.location_address ILIKE $${i})`,
      );
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const from = `FROM job_seeker_posts p JOIN accounts a ON a.id = p.account_id ${where}`;
    const count = await this.pool.query(`SELECT COUNT(*) ${from}`, values);
    values.push(filter.limit, (filter.page - 1) * filter.limit);
    const rows = await this.pool.query(
      `SELECT p.*, a.full_name, a.mobile_number, a.status AS account_status ${from}
       ORDER BY p.updated_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return { items: rows.rows.map(mapAdminPost), total: Number(count.rows[0].count), page: filter.page, limit: filter.limit };
  }

  /** A live post as customers see it (name and phone to call), or null. */
  async findPublicById(id: string): Promise<JobSeekerSearchResult | null> {
    const result = await this.pool.query(
      `SELECT p.*, a.full_name, a.mobile_number, 0 AS distance_meters
       FROM job_seeker_posts p JOIN accounts a ON a.id = p.account_id
       WHERE p.id = $1 AND p.is_active AND a.status = 'active'`,
      [id],
    );
    const row = result.rows[0];
    return row
      ? { ...mapPost(row), fullName: row.full_name, mobileNumber: row.mobile_number, distanceMeters: Number(row.distance_meters) }
      : null;
  }

  async adminGet(id: string): Promise<AdminJobSeekerPost | null> {
    const result = await this.pool.query(
      `SELECT p.*, a.full_name, a.mobile_number, a.status AS account_status
       FROM job_seeker_posts p JOIN accounts a ON a.id = p.account_id WHERE p.id = $1`,
      [id],
    );
    return result.rows[0] ? mapAdminPost(result.rows[0]) : null;
  }

  async adminSetActive(id: string, isActive: boolean): Promise<boolean> {
    const result = await this.pool.query(`UPDATE job_seeker_posts SET is_active = $2, updated_at = now() WHERE id = $1`, [
      id,
      isActive,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  async adminDelete(id: string): Promise<{ accountId: string; photoUrl: string | null } | null> {
    const result = await this.pool.query(`DELETE FROM job_seeker_posts WHERE id = $1 RETURNING account_id, photo_url`, [id]);
    return result.rows[0] ? { accountId: result.rows[0].account_id, photoUrl: result.rows[0].photo_url ?? null } : null;
  }

  async adminCounts(): Promise<{ total: number; live: number }> {
    const result = await this.pool.query(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active) AS live FROM job_seeker_posts`,
    );
    return { total: Number(result.rows[0].total), live: Number(result.rows[0].live) };
  }
  async findCustomTitles(query: string): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT ON (lower(title)) title FROM job_seeker_posts
       WHERE category = 'other' AND is_active AND title ILIKE $1
       ORDER BY lower(title)
       LIMIT 15`,
      [`%${query}%`],
    );
    return result.rows.map((row) => row.title);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAdminPost(row: any): AdminJobSeekerPost {
  return { ...mapPost(row), fullName: row.full_name, mobileNumber: row.mobile_number, accountStatus: row.account_status };

}
