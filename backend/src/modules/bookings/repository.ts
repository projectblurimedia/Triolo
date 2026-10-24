import { timingSafeEqual } from 'crypto';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { parsePgArray } from '@/common/utils/pgArray';
import {
  AcceptOfferResult,
  BookingOfferInsert,
  BookingRequest,
  BookingRequestStatus,
  BROADCAST_TTL_MINUTES,
  DIRECT_TTL_MINUTES,
  LATE_AFTER_MINUTES,
  LATE_STATUSES,
  BookingTransition,
  CANCELLABLE_STATUSES,
  CreateAssignedBookingParams,
  CreateBookingRequestParams,
  CustomerBooking,
  MAX_PIN_ATTEMPTS,
  NotifyTarget,
  PendingOffer,
  RatedJob,
  TRIP_STATUSES,
  VerifyPinResult,
  WORKER_CANCELLABLE_STATUSES,
  WorkerJob,
  ADMIN_ACTIVE_STATUSES,
  AdminBooking,
  AdminBookingDetail,
  AdminBookingListFilter,
  AdminCancelResult,
  DueOffer,
} from './interfaces';
import { displaySkills } from './skills';

function mapBookingRequest(row: QueryResultRow): BookingRequest {
  return {
    id: row.id,
    accountId: row.account_id,
    skillCategories: displaySkills(parsePgArray(row.skill_categories), parsePgArray(row.custom_skills ?? '{}')),
    latitude: row.latitude,
    longitude: row.longitude,
    locationAddress: row.location_address ?? null,
    radiusKm: Number(row.radius_km),
    status: row.status,
    acceptedWorkerId: row.accepted_worker_id ?? null,
    acceptedAt: row.accepted_at ?? null,
    startedAt: row.started_at ?? null,
    arrivedAt: row.arrived_at ?? null,
    pinVerifiedAt: row.pin_verified_at ?? null,
    workDoneAt: row.work_done_at ?? null,
    completedAt: row.completed_at ?? null,
    cancelledAt: row.cancelled_at ?? null,
    cancelledBy: row.cancelled_by ?? null,
    cancelReason: row.cancel_reason ?? null,
    expiredAt: row.expired_at ?? null,
    workerRating: row.worker_rating ?? null,
    workerReview: row.worker_review ?? null,
    problemPostId: row.problem_post_id ?? null,
    quotationAmount: row.quotation_amount != null ? Number(row.quotation_amount) : null,
    targetWorkerId: row.target_worker_id ?? null,
    createdAt: row.created_at,
  };
}

function mapCustomerBooking(row: QueryResultRow): CustomerBooking {
  const request = mapBookingRequest(row);
  const tripActive = TRIP_STATUSES.includes(request.status);
  const workerSkills = row.worker_skill_categories ? parsePgArray(row.worker_skill_categories) : null;
  const ratingCount = Number(row.worker_rating_count ?? 0);
  return {
    ...request,
    worker: row.worker_full_name
      ? {
          fullName: row.worker_full_name,
          mobileNumber: row.worker_mobile_number,
          skillCategories: workerSkills ?? [],
          ratingAverage: ratingCount > 0 ? Math.round((Number(row.worker_rating_sum) / ratingCount) * 10) / 10 : null,
          ratingCount,
          latitude: tripActive ? (row.worker_latitude ?? null) : null,
          longitude: tripActive ? (row.worker_longitude ?? null) : null,
          locationUpdatedAt: tripActive ? (row.worker_location_at ?? null) : null,
        }
      : null,
    arrivalPin: tripActive ? (row.arrival_pin ?? null) : null,
    directWorker: row.target_worker_full_name ? { fullName: row.target_worker_full_name } : null,
    acceptedWorkerFullName: row.worker_full_name ?? null,
    acceptedWorkerSkillCategories: workerSkills,
  };
}

function mapWorkerJob(row: QueryResultRow): WorkerJob {
  return {
    ...mapBookingRequest(row),
    customerFullName: row.customer_full_name,
    customerMobileNumber: row.customer_mobile_number,
    distanceMeters: row.offer_distance_meters != null ? Number(row.offer_distance_meters) : null,
    workerLatitude: row.worker_latitude ?? null,
    workerLongitude: row.worker_longitude ?? null,
    pinAttemptsLeft: Math.max(0, MAX_PIN_ATTEMPTS - Number(row.pin_attempts ?? 0)),
  };
}

function mapTransition(row: QueryResultRow | undefined): BookingTransition | null {
  if (!row) return null;
  return {
    request: mapBookingRequest(row),
    notify: row.notify_account_id ? { accountId: row.notify_account_id, preferredLanguage: row.notify_language } : null,
  };
}

// The customer's view joins the accepted worker's name, phone, skills and rating — same-module
// FK joins for display context, the same pattern acceptOffer's losers query already uses.
const CUSTOMER_BOOKING_SELECT = `
  SELECT br.*, wa.full_name AS worker_full_name, wa.mobile_number AS worker_mobile_number,
         w.skill_categories AS worker_skill_categories, w.rating_sum AS worker_rating_sum,
         w.rating_count AS worker_rating_count, ta.full_name AS target_worker_full_name
  FROM booking_requests br
  LEFT JOIN worker_profiles w ON w.id = br.accepted_worker_id
  LEFT JOIN accounts wa ON wa.id = w.account_id
  LEFT JOIN worker_profiles tw ON tw.id = br.target_worker_id
  LEFT JOIN accounts ta ON ta.id = tw.account_id`;

/**
 * Whether a request (alias `br`) is still young enough to be offered or accepted: a Quick Book
 * broadcast for BROADCAST_TTL_MINUTES, a booking of a particular worker for DIRECT_TTL_MINUTES.
 * (Constants only — no user input in this SQL.)
 */
const STILL_OPEN = `br.created_at > now() - make_interval(mins => CASE WHEN br.target_worker_id IS NULL
  THEN ${BROADCAST_TTL_MINUTES} ELSE ${DIRECT_TTL_MINUTES} END)`;

const WORKER_JOB_SELECT = `
  SELECT br.*, ca.full_name AS customer_full_name, ca.mobile_number AS customer_mobile_number,
         bo.distance_meters AS offer_distance_meters
  FROM booking_requests br
  JOIN accounts ca ON ca.id = br.account_id
  LEFT JOIN booking_offers bo ON bo.booking_request_id = br.id AND bo.worker_id = br.accepted_worker_id`;

// Wraps a single-statement status change so it also returns who to notify: the customer
// (the request's own account) or the accepted worker's account.
const NOTIFY_CUSTOMER = `SELECT u.*, a.id AS notify_account_id, a.preferred_language AS notify_language
  FROM updated u JOIN accounts a ON a.id = u.account_id`;
const NOTIFY_WORKER = `SELECT u.*, wa.id AS notify_account_id, wa.preferred_language AS notify_language
  FROM updated u
  LEFT JOIN worker_profiles w ON w.id = u.accepted_worker_id
  LEFT JOIN accounts wa ON wa.id = w.account_id`;

export class BookingsRepository {
  constructor(private readonly pool: Pool) {}

  async createRequest(params: CreateBookingRequestParams): Promise<BookingRequest> {
    const result = await this.pool.query(
      `INSERT INTO booking_requests (account_id, skill_categories, latitude, longitude, location_address, radius_km, target_worker_id, custom_skills)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        params.accountId,
        params.skillCategories,
        params.latitude,
        params.longitude,
        params.locationAddress,
        params.radiusKm,
        params.targetWorkerId ?? null,
        params.customSkills ?? [],
      ],
    );
    return mapBookingRequest(result.rows[0]);
  }

  /**
   * A trip that starts already accepted — for a Your Problems post a worker just won. No
   * broadcast; the worker's single 'accepted' offer row records the distance like a Quick
   * Book win would, so both kinds of job read the same everywhere after this.
   */
  async createAssigned(params: CreateAssignedBookingParams): Promise<BookingRequest> {
    return this.inTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO booking_requests (account_id, skill_categories, latitude, longitude, location_address, radius_km,
                                       status, accepted_worker_id, accepted_at, arrival_pin, problem_post_id, quotation_amount)
         VALUES ($1, $2, $3, $4, $5, 0, 'accepted', $6, now(), $7, $8, $9)
         RETURNING *`,
        [
          params.customerAccountId,
          params.skillCategories,
          params.latitude,
          params.longitude,
          params.locationAddress,
          params.workerId,
          params.arrivalPin,
          params.problemPostId,
          params.quotationAmount,
        ],
      );
      const request = mapBookingRequest(result.rows[0]);
      await client.query(
        `INSERT INTO booking_offers (booking_request_id, worker_id, status, distance_meters) VALUES ($1, $2, 'accepted', $3)`,
        [request.id, params.workerId, params.distanceMeters ?? 0],
      );
      return request;
    });
  }

  async findStatuses(ids: string[]): Promise<Map<string, BookingRequestStatus>> {
    const statuses = new Map<string, BookingRequestStatus>();
    if (ids.length === 0) return statuses;
    const result = await this.pool.query(`SELECT id, status FROM booking_requests WHERE id = ANY($1::uuid[])`, [ids]);
    for (const row of result.rows) statuses.set(row.id, row.status);
    return statuses;
  }

  /** Finished, rated or reviewed trips for one worker, newest first — their public reviews. */
  async findRatedForWorker(workerId: string, limit: number): Promise<RatedJob[]> {
    const result = await this.pool.query(
      `SELECT br.worker_rating, br.worker_review, br.skill_categories, br.custom_skills,
              COALESCE(br.completed_at, br.cancelled_at) AS completed_at, ca.full_name AS customer_full_name
       FROM booking_requests br
       JOIN accounts ca ON ca.id = br.account_id
       WHERE br.accepted_worker_id = $1 AND br.status IN ('completed', 'cancelled')
         AND (br.worker_rating IS NOT NULL OR br.worker_review IS NOT NULL)
       ORDER BY COALESCE(br.completed_at, br.cancelled_at) DESC
       LIMIT $2`,
      [workerId, limit],
    );
    return result.rows.map((row) => ({
      rating: row.worker_rating ?? null,
      review: row.worker_review ?? null,
      customerFullName: row.customer_full_name,
      skillCategories: displaySkills(parsePgArray(row.skill_categories), parsePgArray(row.custom_skills ?? '{}')),
      completedAt: row.completed_at,
    }));
  }

  /** Bulk insert via `unnest` — one round trip regardless of how many workers matched. */
  async createOffers(bookingRequestId: string, offers: BookingOfferInsert[]): Promise<void> {
    if (offers.length === 0) return;
    // A delayed offer is hidden (and not pushed) until its visible_after; the rest are pushed now.
    await this.pool.query(
      `INSERT INTO booking_offers (booking_request_id, worker_id, distance_meters, visible_after, pushed_at)
       SELECT $1, worker_id, distance_meters, now() + make_interval(secs => delay),
              CASE WHEN delay > 0 THEN NULL ELSE now() END
       FROM unnest($2::uuid[], $3::float8[], $4::int[]) AS t(worker_id, distance_meters, delay)`,
      [
        bookingRequestId,
        offers.map((o) => o.workerId),
        offers.map((o) => o.distanceMeters),
        offers.map((o) => Math.max(0, Math.round(o.delaySeconds ?? 0))),
      ],
    );
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.pool.query(`SELECT 1 FROM booking_requests WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // --- Customer side ---

  async findByIdForAccount(id: string, accountId: string): Promise<CustomerBooking | null> {
    const result = await this.pool.query(`${CUSTOMER_BOOKING_SELECT} WHERE br.id = $1 AND br.account_id = $2`, [id, accountId]);
    return result.rows[0] ? mapCustomerBooking(result.rows[0]) : null;
  }

  async findForCustomer(accountId: string, limit: number): Promise<CustomerBooking[]> {
    const result = await this.pool.query(
      `${CUSTOMER_BOOKING_SELECT} WHERE br.account_id = $1 ORDER BY br.created_at DESC LIMIT $2`,
      [accountId, limit],
    );
    return result.rows.map(mapCustomerBooking);
  }

  /** Customer confirms finished (only after the worker marked work done, so no step is skipped), storing their rating once. */
  async complete(id: string, accountId: string, rating: number | null, review: string | null): Promise<BookingTransition | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE booking_requests SET status = 'completed', completed_at = now(), worker_rating = $3, worker_review = $4
         WHERE id = $1 AND account_id = $2 AND status = 'work_done'
         RETURNING *
       ) ${NOTIFY_WORKER}`,
      [id, accountId, rating, review],
    );
    return mapTransition(result.rows[0]);
  }

  /**
   * Customer cancels before the PIN is verified. Any still-pending offers for the request are
   * closed too, so the job disappears from every other worker's list.
   */
  async cancel(id: string, accountId: string): Promise<BookingTransition | null> {
    return this.inTransaction(async (client) => {
      const result = await client.query(
        `WITH updated AS (
           UPDATE booking_requests SET status = 'cancelled', cancelled_by = 'customer', cancelled_at = now(), arrival_pin = NULL
           WHERE id = $1 AND account_id = $2 AND status = ANY($3::booking_request_status[])
           RETURNING *
         ) ${NOTIFY_WORKER}`,
        [id, accountId, CANCELLABLE_STATUSES],
      );
      if (!result.rows[0]) return null;
      await client.query(`UPDATE booking_offers SET status = 'lost' WHERE booking_request_id = $1 AND status = 'pending'`, [id]);
      return mapTransition(result.rows[0]);
    });
  }

  /**
   * The customer cancels a worker who accepted over LATE_AFTER_MINUTES ago and still hasn't
   * arrived, rating them — the rating counts like a finished job's.
   */
  async cancelLate(id: string, accountId: string, rating: number, review: string | null): Promise<BookingTransition | null> {
    return this.inTransaction(async (client) => {
      const result = await client.query(
        `WITH updated AS (
           UPDATE booking_requests SET status = 'cancelled', cancelled_by = 'customer', cancelled_at = now(), arrival_pin = NULL,
             cancel_reason = 'late', worker_rating = $4, worker_review = $5
           WHERE id = $1 AND account_id = $2 AND status = ANY($3::booking_request_status[])
             AND accepted_worker_id IS NOT NULL AND accepted_at <= now() - make_interval(mins => ${LATE_AFTER_MINUTES})
           RETURNING *
         ) ${NOTIFY_WORKER}`,
        [id, accountId, LATE_STATUSES, rating, review],
      );
      if (!result.rows[0]) return null;
      await client.query(`UPDATE booking_offers SET status = 'lost' WHERE booking_request_id = $1 AND status = 'pending'`, [id]);
      return mapTransition(result.rows[0]);
    });
  }

  /** The customer's name, for the worker's personal request. */
  async findAccountName(accountId: string): Promise<string | null> {
    const result = await this.pool.query(`SELECT full_name FROM accounts WHERE id = $1`, [accountId]);
    return result.rows[0]?.full_name ?? null;
  }

  /** The asked worker's account and language, for their personal push. */
  async findWorkerContact(workerId: string): Promise<NotifyTarget | null> {
    const result = await this.pool.query(
      `SELECT a.id, a.preferred_language FROM worker_profiles w JOIN accounts a ON a.id = w.account_id
       WHERE w.id = $1 AND a.status = 'active'`,
      [workerId],
    );
    const row = result.rows[0];
    return row ? { accountId: row.id, preferredLanguage: row.preferred_language } : null;
  }

  // --- Worker side ---

  /**
   * The asked worker turning down a booking of them in particular: there's nobody else to
   * ask, so it ends ('cancelled' by the worker) and the customer is told.
   */
  async declineDirect(id: string, workerId: string): Promise<BookingTransition | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE booking_requests SET status = 'cancelled', cancelled_by = 'worker', cancelled_at = now(), arrival_pin = NULL
         WHERE id = $1 AND target_worker_id = $2 AND status = 'broadcasting'
         RETURNING *
       ) ${NOTIFY_CUSTOMER}`,
      [id, workerId],
    );
    return mapTransition(result.rows[0]);
  }

  async declineOffer(bookingRequestId: string, workerId: string): Promise<void> {
    await this.pool.query(
      `UPDATE booking_offers SET status = 'declined' WHERE booking_request_id = $1 AND worker_id = $2 AND status = 'pending'`,
      [bookingRequestId, workerId],
    );
  }

  /**
   * Ends every broadcast nobody accepted in time ('expired'). Run lazily before bookings are
   * read, so nothing has to run on a timer; the offer and accept queries also check the age
   * themselves, so a stale request can never be offered or won even before this runs.
   */
  /** Ends Quick Books nobody took in time; returns their ids. */
  async expireStaleBroadcasts(): Promise<string[]> {
    const result = await this.pool.query(
      `UPDATE booking_requests br SET status = 'expired', expired_at = now()
       WHERE br.status = 'broadcasting' AND NOT (${STILL_OPEN})
       RETURNING br.id`,
    );
    return result.rows.map((row) => row.id);
  }

  /**
   * "Find jobs now": adds an offer for this worker on every Quick Book still looking for
   * someone that they could have been offered — within that request's own radius of the
   * worker, needing only skills they have, not their own (a declined one comes back) — so a
   * missed push (or a worker who wasn't in range when it went out) never hides a live job. The
   * unique (request, worker) key makes it safe to run any number of times.
   */
  async addOffersForOpenRequests(
    workerId: string,
    workerAccountId: string,
    skillCategories: string[],
    latitude: number,
    longitude: number,
    // A worker without the head start only finds requests at least this old.
    minAgeSeconds = 0,
    otherSkillDescription: string | null = null,
  ): Promise<number> {
    const result = await this.pool.query(
      `INSERT INTO booking_offers (booking_request_id, worker_id, distance_meters, pushed_at)
       SELECT sub.id, $1, sub.distance_meters, now() FROM (
         SELECT br.id, br.radius_km,
           (6371000 * acos(LEAST(1.0, GREATEST(-1.0,
             cos(radians($3)) * cos(radians(br.latitude)) * cos(radians(br.longitude) - radians($4)) + sin(radians($3)) * sin(radians(br.latitude))
           )))) AS distance_meters
         FROM booking_requests br
         WHERE br.status = 'broadcasting'
           AND br.target_worker_id IS NULL
           AND ${STILL_OPEN}
           AND br.account_id != $2
           AND br.skill_categories <@ $5::worker_skill_category[]
           AND NOT EXISTS (SELECT 1 FROM unnest(br.custom_skills) c WHERE COALESCE($7, '') NOT ILIKE '%' || c || '%')
           AND br.created_at <= now() - make_interval(secs => $6)
       ) sub
       WHERE sub.distance_meters <= sub.radius_km * 1000
       ON CONFLICT (booking_request_id, worker_id)
         DO UPDATE SET status = 'pending' WHERE booking_offers.status = 'declined'`,
      [workerId, workerAccountId, latitude, longitude, skillCategories, minAgeSeconds, otherSkillDescription],
    );
    return result.rowCount ?? 0;
  }

  /**
   * Delayed offers (workers without the head start) whose time has come, marked pushed in the
   * same statement so two callers never push the same one twice.
   */
  async claimDueOffers(): Promise<DueOffer[]> {
    const result = await this.pool.query(
      `UPDATE booking_offers bo SET pushed_at = now()
       FROM booking_requests br, worker_profiles w, accounts a
       WHERE bo.pushed_at IS NULL AND bo.visible_after <= now() AND bo.status = 'pending'
         AND br.id = bo.booking_request_id AND br.status = 'broadcasting' AND ${STILL_OPEN}
         AND w.id = bo.worker_id AND a.id = w.account_id
       RETURNING bo.booking_request_id, bo.distance_meters, br.skill_categories, br.custom_skills, a.id AS account_id, a.preferred_language`,
    );
    return result.rows.map((row) => ({
      bookingRequestId: row.booking_request_id,
      distanceMeters: Number(row.distance_meters),
      skillCategories: displaySkills(parsePgArray(row.skill_categories), parsePgArray(row.custom_skills ?? '{}')),
      accountId: row.account_id,
      preferredLanguage: row.preferred_language,
    }));
  }

  async findPendingOffersForWorker(workerId: string): Promise<PendingOffer[]> {
    const result = await this.pool.query(
      `SELECT bo.id AS offer_id, bo.booking_request_id, bo.distance_meters, bo.created_at, br.skill_categories, br.custom_skills,
              br.location_address, br.target_worker_id, ca.full_name AS customer_full_name
       FROM booking_offers bo
       JOIN booking_requests br ON br.id = bo.booking_request_id
       JOIN accounts ca ON ca.id = br.account_id
       WHERE bo.worker_id = $1 AND bo.status = 'pending' AND br.status = 'broadcasting'
         AND bo.visible_after <= now()
         AND ${STILL_OPEN}
       ORDER BY bo.created_at DESC`,
      [workerId],
    );
    return result.rows.map((row) => ({
      offerId: row.offer_id,
      bookingRequestId: row.booking_request_id,
      skillCategories: displaySkills(parsePgArray(row.skill_categories), parsePgArray(row.custom_skills ?? '{}')),
      distanceMeters: Number(row.distance_meters),
      customerFullName: row.customer_full_name,
      locationAddress: row.location_address ?? null,
      direct: row.target_worker_id != null,
      createdAt: row.created_at,
    }));
  }

  async findJobForWorker(id: string, workerId: string): Promise<WorkerJob | null> {
    const result = await this.pool.query(`${WORKER_JOB_SELECT} WHERE br.id = $1 AND br.accepted_worker_id = $2`, [id, workerId]);
    return result.rows[0] ? mapWorkerJob(result.rows[0]) : null;
  }

  /** Active jobs first, then history, newest first. */
  async findJobsForWorker(workerId: string, limit: number): Promise<WorkerJob[]> {
    const result = await this.pool.query(
      `${WORKER_JOB_SELECT}
       WHERE br.accepted_worker_id = $1
       ORDER BY (br.status IN ('completed', 'cancelled')) ASC, br.created_at DESC
       LIMIT $2`,
      [workerId, limit],
    );
    return result.rows.map(mapWorkerJob);
  }

  /**
   * Race-safe first-accept-wins: the `UPDATE ... WHERE status = 'broadcasting'` only ever
   * affects a row once — Postgres's row-level lock means a second, concurrent call for the
   * same request blocks until the first commits, then finds `status` no longer matches and
   * affects 0 rows. The winner's arrival PIN is set in the same statement. Everything (the
   * request flip, this worker's own offer, every other still-pending offer) happens in one
   * transaction so a crash midway can't leave two offers 'accepted'.
   */
  async acceptOffer(bookingRequestId: string, workerId: string, arrivalPin: string): Promise<AcceptOfferResult> {
    const outcome = await this.inTransaction<AcceptOfferResult | null>(
      async (client) => {
        const requestResult = await client.query(
          // A booking of a particular worker can only be accepted by that worker.
          `UPDATE booking_requests br
         SET status = 'accepted', accepted_worker_id = $2, accepted_at = now(), arrival_pin = $3, pin_attempts = 0
         WHERE br.id = $1 AND br.status = 'broadcasting' AND ${STILL_OPEN}
           AND (br.target_worker_id IS NULL OR br.target_worker_id = $2)
         RETURNING *`,
          [bookingRequestId, workerId, arrivalPin],
        );
        if (requestResult.rowCount === 0) return null;

        await client.query(`UPDATE booking_offers SET status = 'accepted' WHERE booking_request_id = $1 AND worker_id = $2`, [
          bookingRequestId,
          workerId,
        ]);

        const losers = await client.query(
          `UPDATE booking_offers bo SET status = 'lost'
         FROM worker_profiles w, accounts a
         WHERE bo.booking_request_id = $1 AND bo.worker_id != $2 AND bo.status = 'pending'
           AND bo.worker_id = w.id AND w.account_id = a.id
         RETURNING a.id AS account_id, a.preferred_language`,
          [bookingRequestId, workerId],
        );

        const request = mapBookingRequest(requestResult.rows[0]);
        const customer = await client.query(`SELECT id, preferred_language FROM accounts WHERE id = $1`, [request.accountId]);

        return {
          won: true,
          request,
          customer: { accountId: customer.rows[0].id, preferredLanguage: customer.rows[0].preferred_language } as NotifyTarget,
          losingWorkers: losers.rows.map((row) => ({ accountId: row.account_id, preferredLanguage: row.preferred_language })),
        };
      },
      { rollbackOn: (value) => value === null },
    );
    return outcome ?? { won: false };
  }

  /** The accepted worker backs out before the PIN is verified; the customer is told. */
  async cancelByWorker(id: string, workerId: string, reason: string | null): Promise<BookingTransition | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE booking_requests
         SET status = 'cancelled', cancelled_by = 'worker', cancel_reason = $3, cancelled_at = now(), arrival_pin = NULL
         WHERE id = $1 AND accepted_worker_id = $2 AND status = ANY($4::booking_request_status[])
         RETURNING *
       ) ${NOTIFY_CUSTOMER}`,
      [id, workerId, reason, WORKER_CANCELLABLE_STATUSES],
    );
    return mapTransition(result.rows[0]);
  }

  /** accepted → on_the_way. */
  async startTrip(id: string, workerId: string): Promise<BookingTransition | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE booking_requests SET status = 'on_the_way', started_at = now()
         WHERE id = $1 AND accepted_worker_id = $2 AND status = 'accepted'
         RETURNING *
       ) ${NOTIFY_CUSTOMER}`,
      [id, workerId],
    );
    return mapTransition(result.rows[0]);
  }

  /** The travelling worker's latest position. False when the trip isn't active (or not theirs). */
  async updateWorkerLocation(id: string, workerId: string, latitude: number, longitude: number): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE booking_requests SET worker_latitude = $3, worker_longitude = $4, worker_location_at = now()
       WHERE id = $1 AND accepted_worker_id = $2 AND status = ANY($5::booking_request_status[])`,
      [id, workerId, latitude, longitude, TRIP_STATUSES],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** accepted / on_the_way → arrived (a worker already nearby can skip Start Trip). */
  async markArrived(id: string, workerId: string): Promise<BookingTransition | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE booking_requests SET status = 'arrived', arrived_at = now(), started_at = COALESCE(started_at, now())
         WHERE id = $1 AND accepted_worker_id = $2 AND status IN ('accepted', 'on_the_way')
         RETURNING *
       ) ${NOTIFY_CUSTOMER}`,
      [id, workerId],
    );
    return mapTransition(result.rows[0]);
  }

  /**
   * Checks the customer's PIN under a row lock, so attempts are counted exactly even if two
   * tries race. MAX_PIN_ATTEMPTS wrong tries lock it; a correct PIN is cleared (single use)
   * and moves the job to in_progress.
   */
  async verifyPin(id: string, workerId: string, pin: string): Promise<VerifyPinResult> {
    return this.inTransaction(async (client) => {
      const current = await client.query(
        `SELECT * FROM booking_requests
         WHERE id = $1 AND accepted_worker_id = $2 AND status = ANY($3::booking_request_status[])
         FOR UPDATE`,
        [id, workerId, TRIP_STATUSES],
      );
      const row = current.rows[0];
      if (!row || !row.arrival_pin) return { outcome: 'not_found' } as const;
      const attempts = Number(row.pin_attempts ?? 0);
      if (attempts >= MAX_PIN_ATTEMPTS) return { outcome: 'locked' } as const;

      const expected = Buffer.from(String(row.arrival_pin));
      const given = Buffer.from(pin);
      const matches = expected.length === given.length && timingSafeEqual(expected, given);

      if (!matches) {
        await client.query(`UPDATE booking_requests SET pin_attempts = pin_attempts + 1 WHERE id = $1`, [id]);
        return { outcome: 'wrong', attemptsLeft: MAX_PIN_ATTEMPTS - (attempts + 1) } as const;
      }

      const updated = await client.query(
        `WITH updated AS (
           UPDATE booking_requests
           SET status = 'in_progress', pin_verified_at = now(), arrival_pin = NULL,
               arrived_at = COALESCE(arrived_at, now()), started_at = COALESCE(started_at, now())
           WHERE id = $1
           RETURNING *
         ) ${NOTIFY_CUSTOMER}`,
        [id],
      );
      return { outcome: 'verified', transition: mapTransition(updated.rows[0]) as BookingTransition } as const;
    });
  }

  /** in_progress → work_done. */
  async markWorkDone(id: string, workerId: string): Promise<BookingTransition | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE booking_requests SET status = 'work_done', work_done_at = now()
         WHERE id = $1 AND accepted_worker_id = $2 AND status = 'in_progress'
         RETURNING *
       ) ${NOTIFY_CUSTOMER}`,
      [id, workerId],
    );
    return mapTransition(result.rows[0]);
  }

  /**
   * Runs `work` in one transaction. It commits unless `work` throws, or `rollbackOn` says the
   * returned value means "nothing happened" (then it rolls back and still returns the value).
   */
  private async inTransaction<T>(
    work: (client: PoolClient) => Promise<T>,
    options?: { rollbackOn?: (value: T) => boolean },
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const value = await work(client);
      await client.query(options?.rollbackOn?.(value) ? 'ROLLBACK' : 'COMMIT');
      return value;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --- Admin ---

  async adminList(
    filter: AdminBookingListFilter,
  ): Promise<{ items: AdminBooking[]; total: number; page: number; limit: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filter.kind === 'quick') conditions.push('br.problem_post_id IS NULL');
    if (filter.kind === 'problem') conditions.push('br.problem_post_id IS NOT NULL');
    if (filter.group === 'active') {
      values.push(ADMIN_ACTIVE_STATUSES);
      conditions.push(`br.status = ANY($${values.length}::booking_request_status[])`);
    } else if (filter.group) {
      values.push(filter.group);
      conditions.push(`br.status = $${values.length}`);
    }
    if (filter.accountId) {
      values.push(filter.accountId);
      conditions.push(`(br.account_id = $${values.length} OR w.account_id = $${values.length})`);
    }
    if (filter.q) {
      values.push(`%${filter.q}%`);
      const i = values.length;
      conditions.push(
        `(ca.full_name ILIKE $${i} OR ca.mobile_number ILIKE $${i} OR wa.full_name ILIKE $${i} OR wa.mobile_number ILIKE $${i} OR br.location_address ILIKE $${i} OR array_to_string(br.skill_categories, ',') ILIKE $${i})`,
      );
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.pool.query(`SELECT COUNT(*) ${ADMIN_FROM} ${where}`, values);
    values.push(filter.limit, (filter.page - 1) * filter.limit);
    const rows = await this.pool.query(
      `${ADMIN_SELECT} ${ADMIN_FROM} ${where} ORDER BY br.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return { items: rows.rows.map(mapAdminBooking), total: Number(count.rows[0].count), page: filter.page, limit: filter.limit };
  }

  async adminGet(id: string): Promise<AdminBookingDetail | null> {
    const result = await this.pool.query(`${ADMIN_SELECT} ${ADMIN_FROM} WHERE br.id = $1`, [id]);
    if (!result.rows[0]) return null;
    const offers = await this.pool.query(
      `SELECT bo.worker_id, bo.distance_meters, bo.status, bo.created_at, a.full_name, a.mobile_number
       FROM booking_offers bo
       JOIN worker_profiles w ON w.id = bo.worker_id
       JOIN accounts a ON a.id = w.account_id
       WHERE bo.booking_request_id = $1
       ORDER BY bo.distance_meters ASC`,
      [id],
    );
    return {
      ...mapAdminBooking(result.rows[0]),
      offers: offers.rows.map((row) => ({
        workerId: row.worker_id,
        fullName: row.full_name,
        mobileNumber: row.mobile_number,
        distanceMeters: Number(row.distance_meters),
        status: row.status,
        createdAt: row.created_at,
      })),
    };
  }

  /** Stops any unfinished booking; returns both people to tell. Null if it was already over. */
  async adminCancel(id: string, reason: string | null): Promise<AdminCancelResult | null> {
    return this.inTransaction(async (client) => {
      const updated = await client.query(
        `UPDATE booking_requests
         SET status = 'cancelled', cancelled_by = 'admin', cancel_reason = $2, cancelled_at = now(), arrival_pin = NULL
         WHERE id = $1 AND status = ANY($3::booking_request_status[])
         RETURNING *`,
        [id, reason, ADMIN_ACTIVE_STATUSES],
      );
      if (!updated.rows[0]) return null;
      await client.query(`UPDATE booking_offers SET status = 'lost' WHERE booking_request_id = $1 AND status = 'pending'`, [id]);
      const request = mapBookingRequest(updated.rows[0]);
      const people = await client.query(
        `SELECT ca.id AS customer_id, ca.preferred_language AS customer_language,
                wa.id AS worker_account_id, wa.preferred_language AS worker_language
         FROM booking_requests br
         JOIN accounts ca ON ca.id = br.account_id
         LEFT JOIN worker_profiles w ON w.id = br.accepted_worker_id
         LEFT JOIN accounts wa ON wa.id = w.account_id
         WHERE br.id = $1`,
        [id],
      );
      const row = people.rows[0];
      return {
        request,
        customer: { accountId: row.customer_id, preferredLanguage: row.customer_language },
        worker: row.worker_account_id ? { accountId: row.worker_account_id, preferredLanguage: row.worker_language } : null,
      };
    });
  }

  /** Unfinished bookings an account is part of, as the customer or as the worker. */
  async adminActiveIdsForAccount(accountId: string): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT br.id FROM booking_requests br
       LEFT JOIN worker_profiles w ON w.id = br.accepted_worker_id
       WHERE (br.account_id = $1 OR w.account_id = $1) AND br.status = ANY($2::booking_request_status[])`,
      [accountId, ADMIN_ACTIVE_STATUSES],
    );
    return result.rows.map((row) => row.id);
  }

  async adminCounts(): Promise<{ active: number; searching: number; completed: number; cancelled: number; today: number }> {
    const result = await this.pool.query(
      `SELECT COUNT(*) FILTER (WHERE status = ANY($1::booking_request_status[])) AS active,
              COUNT(*) FILTER (WHERE status = 'broadcasting') AS searching,
              COUNT(*) FILTER (WHERE status = 'completed') AS completed,
              COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
              COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now())) AS today
       FROM booking_requests`,
      [ADMIN_ACTIVE_STATUSES],
    );
    const row = result.rows[0];
    return {
      active: Number(row.active),
      searching: Number(row.searching),
      completed: Number(row.completed),
      cancelled: Number(row.cancelled),
      today: Number(row.today),
    };
  }
}

const ADMIN_SELECT = `SELECT br.*, ca.full_name AS customer_full_name, ca.mobile_number AS customer_mobile_number,
  w.account_id AS worker_account_id, wa.full_name AS worker_full_name, wa.mobile_number AS worker_mobile_number,
  (SELECT COUNT(*) FROM booking_offers bo WHERE bo.booking_request_id = br.id) AS offer_count`;
const ADMIN_FROM = `FROM booking_requests br
  JOIN accounts ca ON ca.id = br.account_id
  LEFT JOIN worker_profiles w ON w.id = br.accepted_worker_id
  LEFT JOIN accounts wa ON wa.id = w.account_id`;

function mapAdminBooking(row: QueryResultRow): AdminBooking {
  return {
    ...mapBookingRequest(row),
    customer: { accountId: row.account_id, fullName: row.customer_full_name, mobileNumber: row.customer_mobile_number },
    worker: row.worker_account_id
      ? {
          accountId: row.worker_account_id,
          workerId: row.accepted_worker_id,
          fullName: row.worker_full_name,
          mobileNumber: row.worker_mobile_number,
        }
      : null,
    offerCount: Number(row.offer_count ?? 0),
  };
}
