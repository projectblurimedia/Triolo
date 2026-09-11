import { Pool, QueryResultRow } from 'pg';
import { parsePgArray } from '@/common/utils/pgArray';
import {
  AcceptOfferResult,
  BookingOfferInsert,
  BookingRequest,
  BookingRequestWithAcceptedWorker,
  CreateBookingRequestParams,
  PendingOffer,
} from './interfaces';

function mapBookingRequest(row: QueryResultRow): BookingRequest {
  return {
    id: row.id,
    accountId: row.account_id,
    skillCategories: parsePgArray(row.skill_categories),
    latitude: row.latitude,
    longitude: row.longitude,
    radiusKm: Number(row.radius_km),
    status: row.status,
    acceptedWorkerId: row.accepted_worker_id,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
  };
}

export class BookingsRepository {
  constructor(private readonly pool: Pool) {}

  async createRequest(params: CreateBookingRequestParams): Promise<BookingRequest> {
    const result = await this.pool.query(
      `INSERT INTO booking_requests (account_id, skill_categories, latitude, longitude, radius_km)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [params.accountId, params.skillCategories, params.latitude, params.longitude, params.radiusKm],
    );
    return mapBookingRequest(result.rows[0]);
  }

  /** Bulk insert via `unnest` — one round trip regardless of how many workers matched. */
  async createOffers(bookingRequestId: string, offers: BookingOfferInsert[]): Promise<void> {
    if (offers.length === 0) return;
    await this.pool.query(
      `INSERT INTO booking_offers (booking_request_id, worker_id, distance_meters)
       SELECT $1, worker_id, distance_meters FROM unnest($2::uuid[], $3::float8[]) AS t(worker_id, distance_meters)`,
      [bookingRequestId, offers.map((o) => o.workerId), offers.map((o) => o.distanceMeters)],
    );
  }

  async findByIdForAccount(id: string, accountId: string): Promise<BookingRequestWithAcceptedWorker | null> {
    const result = await this.pool.query(
      `SELECT br.*, aw_acc.full_name AS accepted_worker_full_name, aw.skill_categories AS accepted_worker_skill_categories
       FROM booking_requests br
       LEFT JOIN worker_profiles aw ON aw.id = br.accepted_worker_id
       LEFT JOIN accounts aw_acc ON aw_acc.id = aw.account_id
       WHERE br.id = $1 AND br.account_id = $2`,
      [id, accountId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      ...mapBookingRequest(row),
      acceptedWorkerFullName: row.accepted_worker_full_name ?? null,
      acceptedWorkerSkillCategories: row.accepted_worker_skill_categories
        ? parsePgArray(row.accepted_worker_skill_categories)
        : null,
    };
  }

  /** No race to guard against — a worker can only touch their own offer, so a plain scoped
   * UPDATE is enough (unlike acceptOffer, there's no contention between different workers
   * here). Silently affects 0 rows if the offer is already gone (taken/declined already). */
  async declineOffer(bookingRequestId: string, workerId: string): Promise<void> {
    await this.pool.query(
      `UPDATE booking_offers SET status = 'declined' WHERE booking_request_id = $1 AND worker_id = $2 AND status = 'pending'`,
      [bookingRequestId, workerId],
    );
  }

  async findPendingOffersForWorker(workerId: string): Promise<PendingOffer[]> {
    const result = await this.pool.query(
      `SELECT bo.id AS offer_id, bo.booking_request_id, bo.distance_meters, bo.created_at, br.skill_categories
       FROM booking_offers bo
       JOIN booking_requests br ON br.id = bo.booking_request_id
       WHERE bo.worker_id = $1 AND bo.status = 'pending'
       ORDER BY bo.created_at DESC`,
      [workerId],
    );
    return result.rows.map((row) => ({
      offerId: row.offer_id,
      bookingRequestId: row.booking_request_id,
      skillCategories: parsePgArray(row.skill_categories),
      distanceMeters: Number(row.distance_meters),
      createdAt: row.created_at,
    }));
  }

  /**
   * Race-safe first-accept-wins: the `UPDATE ... WHERE status = 'broadcasting'` only ever
   * affects a row once — Postgres's row-level lock means a second, concurrent call for the
   * same request blocks until the first commits, then finds `status` no longer matches and
   * affects 0 rows. Everything (the request flip, this worker's own offer, every other
   * still-pending offer for the same request) happens in one transaction so a crash midway
   * can never leave the data in a state where two offers both read 'accepted', or the
   * request is 'accepted' with no offer to match.
   */
  async acceptOffer(bookingRequestId: string, workerId: string): Promise<AcceptOfferResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const requestResult = await client.query(
        `UPDATE booking_requests SET status = 'accepted', accepted_worker_id = $2, accepted_at = now()
         WHERE id = $1 AND status = 'broadcasting'
         RETURNING *`,
        [bookingRequestId, workerId],
      );
      if (requestResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return { won: false };
      }

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

      await client.query('COMMIT');
      return {
        won: true,
        request: mapBookingRequest(requestResult.rows[0]),
        losingWorkers: losers.rows.map((row) => ({ accountId: row.account_id, preferredLanguage: row.preferred_language })),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
