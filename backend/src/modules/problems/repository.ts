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
  RatedJob,
  UpdateProblemPostParams,
  AdminProblemListFilter,
  AdminProblemPost,
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
    bookingRequestId: row.booking_request_id ?? null,
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
      bookingStatus: null,
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
      bookingStatus: null,
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

  async setBookingRequest(id: string, bookingRequestId: string): Promise<void> {
    await this.pool.query(`UPDATE problem_posts SET booking_request_id = $2 WHERE id = $1`, [id, bookingRequestId]);
  }

  /**
   * Back to open for other workers — after the customer cancels the trip, or if starting
   * the trip failed right after accepting. Only from 'accepted'.
   */
  async reopen(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE problem_posts
       SET status = 'open', accepted_worker_id = NULL, accepted_at = NULL, booking_request_id = NULL
       WHERE id = $1 AND status = 'accepted'`,
      [id],
    );
  }

  /** The linked trip finished: copy its rating/feedback so the post reads as done everywhere. */
  async completeFromTrip(id: string, rating: number | null, review: string | null): Promise<void> {
    await this.pool.query(
      `UPDATE problem_posts
       SET status = 'completed', completed_at = now(), work_done_at = COALESCE(work_done_at, now()),
           worker_rating = $2, worker_review = $3
       WHERE id = $1 AND status IN ('accepted', 'work_done')`,
      [id, rating, review],
    );
  }

  /**
   * Rated jobs for one worker's public reviews. Trip-linked posts are left out: their rating
   * lives on (and is listed from) the trip, so counting both would show it twice.
   */
  async findRatedForWorker(workerId: string, limit: number): Promise<RatedJob[]> {
    const result = await this.pool.query(
      `SELECT p.worker_rating, p.worker_review, p.skill_categories, p.completed_at, a.full_name AS customer_full_name
       FROM problem_posts p
       JOIN accounts a ON a.id = p.account_id
       WHERE p.accepted_worker_id = $1 AND p.status = 'completed' AND p.booking_request_id IS NULL
         AND (p.worker_rating IS NOT NULL OR p.worker_review IS NOT NULL)
       ORDER BY p.completed_at DESC
       LIMIT $2`,
      [workerId, limit],
    );
    return result.rows.map((row) => ({
      rating: row.worker_rating ?? null,
      review: row.worker_review ?? null,
      customerFullName: row.customer_full_name,
      skillCategories: parsePgArray(row.skill_categories),
      completedAt: row.completed_at,
    }));
  }

  /** Only the accepted worker, only from 'accepted'. Returns the customer to notify. */
  async markWorkDone(id: string, workerId: string): Promise<ProblemTransitionResult | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE problem_posts SET status = 'work_done', work_done_at = now()
         WHERE id = $1 AND accepted_worker_id = $2 AND status = 'accepted' AND booking_request_id IS NULL
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
         WHERE id = $1 AND account_id = $2 AND status IN ('accepted', 'work_done') AND booking_request_id IS NULL
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

  // --- Admin ---

  async adminList(
    filter: AdminProblemListFilter,
  ): Promise<{ items: AdminProblemPost[]; total: number; page: number; limit: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const groups: Record<string, string> = {
      open: `p.status = 'open'`,
      in_progress: `p.status IN ('accepted', 'work_done')`,
      completed: `p.status = 'completed'`,
      closed: `p.status = 'closed'`,
    };
    if (filter.group) conditions.push(groups[filter.group]);
    if (filter.accountId) {
      values.push(filter.accountId);
      conditions.push(`(p.account_id = $${values.length} OR w.account_id = $${values.length})`);
    }
    if (filter.q) {
      values.push(`%${filter.q}%`);
      const i = values.length;
      conditions.push(
        `(ca.full_name ILIKE $${i} OR ca.mobile_number ILIKE $${i} OR wa.full_name ILIKE $${i} OR p.location_address ILIKE $${i} OR p.description ILIKE $${i})`,
      );
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.pool.query(`SELECT COUNT(*) ${ADMIN_FROM} ${where}`, values);
    values.push(filter.limit, (filter.page - 1) * filter.limit);
    const rows = await this.pool.query(
      `${ADMIN_SELECT} ${ADMIN_FROM} ${where} ORDER BY p.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return { items: rows.rows.map(mapAdminPost), total: Number(count.rows[0].count), page: filter.page, limit: filter.limit };
  }

  async adminGet(id: string): Promise<AdminProblemPost | null> {
    const result = await this.pool.query(`${ADMIN_SELECT} ${ADMIN_FROM} WHERE p.id = $1`, [id]);
    return result.rows[0] ? mapAdminPost(result.rows[0]) : null;
  }

  /** open → closed, with the admin's reason. Null if the post isn't open any more. */
  async adminClose(id: string, reason: string | null): Promise<ProblemPost | null> {
    const result = await this.pool.query(
      `UPDATE problem_posts SET status = 'closed', closed_reason = $2, closed_at = now()
       WHERE id = $1 AND status = 'open' RETURNING *`,
      [id, reason],
    );
    return result.rows[0] ? mapProblemPost(result.rows[0]) : null;
  }

  /** Closes every open post of an account (when the admin suspends or bans it). */
  async adminCloseOpenForAccount(accountId: string, reason: string | null): Promise<number> {
    const result = await this.pool.query(
      `UPDATE problem_posts SET status = 'closed', closed_reason = $2, closed_at = now()
       WHERE account_id = $1 AND status = 'open'`,
      [accountId, reason],
    );
    return result.rowCount ?? 0;
  }

  async adminCounts(): Promise<{ open: number; inProgress: number; completed: number; closed: number }> {
    const result = await this.pool.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'open') AS open,
              COUNT(*) FILTER (WHERE status IN ('accepted', 'work_done')) AS in_progress,
              COUNT(*) FILTER (WHERE status = 'completed') AS completed,
              COUNT(*) FILTER (WHERE status = 'closed') AS closed
       FROM problem_posts`,
    );
    const row = result.rows[0];
    return {
      open: Number(row.open),
      inProgress: Number(row.in_progress),
      completed: Number(row.completed),
      closed: Number(row.closed),
    };
  }
}

const ADMIN_SELECT = `SELECT p.*, ca.full_name AS customer_full_name, ca.mobile_number AS customer_mobile_number,
  wa.full_name AS worker_full_name, wa.mobile_number AS worker_mobile_number`;
const ADMIN_FROM = `FROM problem_posts p
  JOIN accounts ca ON ca.id = p.account_id
  LEFT JOIN worker_profiles w ON w.id = p.accepted_worker_id
  LEFT JOIN accounts wa ON wa.id = w.account_id`;

function mapAdminPost(row: QueryResultRow): AdminProblemPost {
  return {
    ...mapProblemPost(row),
    customerFullName: row.customer_full_name,
    customerMobileNumber: row.customer_mobile_number,
    workerFullName: row.worker_full_name ?? null,
    workerMobileNumber: row.worker_mobile_number ?? null,
    closedReason: row.closed_reason ?? null,
    closedAt: row.closed_at ?? null,
  };
}
