import { Pool } from 'pg';
import { parsePgArray } from '@/common/utils/pgArray';
import {
  AdminJobSeekerListFilter,
  AdminJobSeekerPost,
  JobSeekerPost,
  JobSeekerSearchParams,
  JobSeekerSearchResult,
  SaveJobSeekerPostParams,
} from './interfaces';

// Great-circle distance in metres, same formula as the workers/problems repositories.
// $1/$2 are the searcher's latitude/longitude.
const DISTANCE_SQL = `(6371000 * acos(LEAST(1.0, GREATEST(-1.0,
  cos(radians($1)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians($2)) + sin(radians($1)) * sin(radians(p.latitude))
))))`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPost(row: any): JobSeekerPost {
  return {
    id: row.id,
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

  async findByAccount(accountId: string): Promise<JobSeekerPost | null> {
    const result = await this.pool.query(`SELECT * FROM job_seeker_posts WHERE account_id = $1`, [accountId]);
    return result.rows[0] ? mapPost(result.rows[0]) : null;
  }

  /** One post per account: creates it, or replaces its details (keeping it shown/hidden as it was). */
  async upsert(accountId: string, params: SaveJobSeekerPostParams): Promise<JobSeekerPost> {
    const result = await this.pool.query(
      `INSERT INTO job_seeker_posts
         (account_id, category, title, pay_amount, pay_period, availability, experience_years, skills,
          description, latitude, longitude, location_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (account_id) DO UPDATE SET
         category = EXCLUDED.category, title = EXCLUDED.title, pay_amount = EXCLUDED.pay_amount,
         pay_period = EXCLUDED.pay_period, availability = EXCLUDED.availability,
         experience_years = EXCLUDED.experience_years, skills = EXCLUDED.skills,
         description = EXCLUDED.description, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
         location_address = EXCLUDED.location_address, updated_at = now()
       RETURNING *`,
      [
        accountId,
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
      ],
    );
    return mapPost(result.rows[0]);
  }

  async setActive(accountId: string, isActive: boolean): Promise<JobSeekerPost | null> {
    const result = await this.pool.query(
      `UPDATE job_seeker_posts SET is_active = $2, updated_at = now() WHERE account_id = $1 RETURNING *`,
      [accountId, isActive],
    );
    return result.rows[0] ? mapPost(result.rows[0]) : null;
  }

  /** Sets (or clears) the photo; returns the post and the photo it replaced, or null with no post. */
  async setPhoto(
    accountId: string,
    photoUrl: string | null,
  ): Promise<{ post: JobSeekerPost; previousUrl: string | null } | null> {
    const result = await this.pool.query(
      `UPDATE job_seeker_posts p SET photo_url = $2, updated_at = now()
       FROM (SELECT photo_url AS previous_url FROM job_seeker_posts WHERE account_id = $1 FOR UPDATE) old
       WHERE p.account_id = $1
       RETURNING p.*, old.previous_url`,
      [accountId, photoUrl],
    );
    if (!result.rows[0]) return null;
    return { post: mapPost(result.rows[0]), previousUrl: result.rows[0].previous_url ?? null };
  }

  /** Deletes the post; returns its photo URL so the caller can remove it from storage. */
  async delete(accountId: string): Promise<{ photoUrl: string | null } | null> {
    const result = await this.pool.query(`DELETE FROM job_seeker_posts WHERE account_id = $1 RETURNING photo_url`, [accountId]);
    return result.rows[0] ? { photoUrl: result.rows[0].photo_url ?? null } : null;
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
        `(p.title ILIKE $${i} OR a.full_name ILIKE $${i} OR p.description ILIKE $${i} OR array_to_string(p.skills, ' ') ILIKE $${i})`,
      );
    }
    values.push(params.limit);
    const limitIndex = values.length;
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
       ORDER BY ${order}
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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAdminPost(row: any): AdminJobSeekerPost {
  return { ...mapPost(row), fullName: row.full_name, mobileNumber: row.mobile_number, accountStatus: row.account_status };
}
