import { Pool, QueryResultRow } from 'pg';
import { parsePgArray } from '@/common/utils/pgArray';
import {
  AssignedProblem,
  CreateProblemPostParams,
  MAX_PROBLEM_PHOTOS,
  NearbyProblem,
  OwnProblemPost,
  ProblemPost,
  ProblemTransitionResult,
  UpdateProblemPostParams,
} from './interfaces';

function mapProblemPost(row: QueryResultRow): ProblemPost {
  return {
    id: row.id,
    accountId: row.account_id,
    skillCategories: parsePgArray(row.skill_categories),
    description: row.description,
    quotationAmount: Number(row.quotation_amount),
    photoUrls: row.photo_urls ?? [],
    locationAddress: row.location_address,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
    acceptedWorkerId: row.accepted_worker_id ?? null,
    acceptedAt: row.accepted_at ?? null,
    workDoneAt: row.work_done_at ?? null,
    completedAt: row.completed_at ?? null,
    workerRating: row.worker_rating ?? null,
    workerReview: row.worker_review ?? null,
    createdAt: row.created_at,
  };
}

function mapTransition(row: QueryResultRow | undefined): ProblemTransitionResult | null {
  if (!row) return null;
  return { post: mapProblemPost(row), notifyAccountId: row.notify_account_id, notifyLanguage: row.notify_language };
}

// Haversine great-circle distance in meters, same formula (and acos() domain clamp) as
// workers/repository.ts's findNearby — $1/$2 are the worker's latitude/longitude.
const DISTANCE_SQL = `(6371000 * acos(LEAST(1.0, GREATEST(-1.0,
  cos(radians($1)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians($2)) + sin(radians($1)) * sin(radians(p.latitude))
))))`;

export class ProblemsRepository {
  constructor(private readonly pool: Pool) {}

  async create(params: CreateProblemPostParams): Promise<ProblemPost> {
    const result = await this.pool.query(
      `INSERT INTO problem_posts (account_id, skill_categories, description, quotation_amount, location_address, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        params.accountId,
        params.skillCategories,
        params.description,
        params.quotationAmount,
        params.locationAddress,
        params.latitude,
        params.longitude,
      ],
    );
    return mapProblemPost(result.rows[0]);
  }

  /** Only while still open — once a worker has accepted, the job's terms are locked. */
  async update(id: string, accountId: string, params: UpdateProblemPostParams): Promise<ProblemPost | null> {
    const result = await this.pool.query(
      `UPDATE problem_posts
       SET skill_categories = $3, description = $4, quotation_amount = $5, location_address = $6,
           latitude = $7, longitude = $8, photo_urls = $9
       WHERE id = $1 AND account_id = $2 AND status = 'open'
       RETURNING *`,
      [
        id,
        accountId,
        params.skillCategories,
        params.description,
        params.quotationAmount,
        params.locationAddress,
        params.latitude,
        params.longitude,
        params.photoUrls,
      ],
    );
    return result.rows[0] ? mapProblemPost(result.rows[0]) : null;
  }

  async findByIdForAccount(id: string, accountId: string): Promise<ProblemPost | null> {
    const result = await this.pool.query(`SELECT * FROM problem_posts WHERE id = $1 AND account_id = $2`, [id, accountId]);
    return result.rows[0] ? mapProblemPost(result.rows[0]) : null;
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.pool.query(`SELECT 1 FROM problem_posts WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /** Appends atomically and only while open and under the photo cap — returns null otherwise. */
  async appendPhoto(id: string, accountId: string, photoUrl: string): Promise<ProblemPost | null> {
    const result = await this.pool.query(
      `UPDATE problem_posts SET photo_urls = array_append(photo_urls, $3)
       WHERE id = $1 AND account_id = $2 AND status = 'open' AND cardinality(photo_urls) < $4
       RETURNING *`,
      [id, accountId, photoUrl, MAX_PROBLEM_PHOTOS],
    );
    return result.rows[0] ? mapProblemPost(result.rows[0]) : null;
  }

  async delete(id: string, accountId: string): Promise<void> {
    await this.pool.query(`DELETE FROM problem_posts WHERE id = $1 AND account_id = $2`, [id, accountId]);
  }

  async findForAccount(accountId: string, limit: number): Promise<OwnProblemPost[]> {
    const result = await this.pool.query(
      `SELECT p.*, wa.full_name AS accepted_worker_full_name, wa.mobile_number AS accepted_worker_mobile_number
       FROM problem_posts p
       LEFT JOIN worker_profiles w ON w.id = p.accepted_worker_id
       LEFT JOIN accounts wa ON wa.id = w.account_id
       WHERE p.account_id = $1
       ORDER BY p.created_at DESC
       LIMIT $2`,
      [accountId, limit],
    );
    return result.rows.map((row) => ({
      ...mapProblemPost(row),
      acceptedWorkerFullName: row.accepted_worker_full_name ?? null,
      acceptedWorkerMobileNumber: row.accepted_worker_mobile_number ?? null,
    }));
  }

  /**
   * Open problems near a worker that need at least one of their skills (array overlap, not
   * containment — a plumber should still see a "plumber + electrician" job). Posts with a
   * typed-only location (no GPS coordinates) can't be distance-matched and are excluded.
   */
  async findNearbyOpen(
    excludeAccountId: string,
    skillCategories: string[],
    latitude: number,
    longitude: number,
    radiusKm: number,
    limit: number,
  ): Promise<NearbyProblem[]> {
    const result = await this.pool.query(
      `SELECT * FROM (
         SELECT p.*, ${DISTANCE_SQL} AS distance_meters
         FROM problem_posts p
         WHERE p.status = 'open'
           AND p.account_id != $3
           AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
           AND p.skill_categories && $4::worker_skill_category[]
       ) sub
       WHERE distance_meters <= $5
       ORDER BY distance_meters ASC, created_at DESC
       LIMIT $6`,
      [latitude, longitude, excludeAccountId, skillCategories, radiusKm * 1000, limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      skillCategories: parsePgArray(row.skill_categories),
      description: row.description,
      quotationAmount: Number(row.quotation_amount),
      photoUrls: row.photo_urls ?? [],
      locationAddress: row.location_address,
      distanceMeters: Number(row.distance_meters),
      createdAt: row.created_at,
    }));
  }

  async findAssignedToWorker(workerId: string, limit: number): Promise<AssignedProblem[]> {
    const result = await this.pool.query(
      `SELECT p.*, a.full_name AS customer_full_name, a.mobile_number AS customer_mobile_number
       FROM problem_posts p
       JOIN accounts a ON a.id = p.account_id
       WHERE p.accepted_worker_id = $1
       ORDER BY (p.status = 'completed') ASC, p.accepted_at DESC
       LIMIT $2`,
      [workerId, limit],
    );
    return result.rows.map((row) => ({
      ...mapProblemPost(row),
      customerFullName: row.customer_full_name,
      customerMobileNumber: row.customer_mobile_number,
    }));
  }

  /**
   * First accept wins: the `WHERE status = 'open'` guard means a second, concurrent accept
   * blocks on the row lock, then matches 0 rows once the first commits. A worker can't
   * accept their own post. Returns the customer to notify, or null if not accepted.
   */
  async accept(id: string, workerId: string, workerAccountId: string): Promise<ProblemTransitionResult | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE problem_posts SET status = 'accepted', accepted_worker_id = $2, accepted_at = now()
         WHERE id = $1 AND status = 'open' AND account_id != $3
         RETURNING *
       )
       SELECT u.*, a.id AS notify_account_id, a.preferred_language AS notify_language
       FROM updated u JOIN accounts a ON a.id = u.account_id`,
      [id, workerId, workerAccountId],
    );
    return mapTransition(result.rows[0]);
  }

  /** Only the accepted worker, only from 'accepted'. Returns the customer to notify. */
  async markWorkDone(id: string, workerId: string): Promise<ProblemTransitionResult | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE problem_posts SET status = 'work_done', work_done_at = now()
         WHERE id = $1 AND accepted_worker_id = $2 AND status = 'accepted'
         RETURNING *
       )
       SELECT u.*, a.id AS notify_account_id, a.preferred_language AS notify_language
       FROM updated u JOIN accounts a ON a.id = u.account_id`,
      [id, workerId],
    );
    return mapTransition(result.rows[0]);
  }

  /**
   * Only the customer, from 'accepted' or 'work_done', with an optional rating that's
   * stored once on the job (a finished job can't be re-completed, so it can't be re-rated).
   * Returns the worker to notify.
   */
  async complete(
    id: string,
    accountId: string,
    rating: number | null,
    review: string | null,
  ): Promise<ProblemTransitionResult | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE problem_posts SET status = 'completed', completed_at = now(), worker_rating = $3, worker_review = $4
         WHERE id = $1 AND account_id = $2 AND status IN ('accepted', 'work_done')
         RETURNING *
       )
       SELECT u.*, wa.id AS notify_account_id, wa.preferred_language AS notify_language
       FROM updated u
       JOIN worker_profiles w ON w.id = u.accepted_worker_id
       JOIN accounts wa ON wa.id = w.account_id`,
      [id, accountId, rating, review],
    );
    return mapTransition(result.rows[0]);
  }
}
