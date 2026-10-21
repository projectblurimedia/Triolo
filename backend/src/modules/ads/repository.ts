import { Pool } from 'pg';
import { Ad, AdActionColumns, AdApp, AdListFilter, AdSettings, AdStatus, AD_SPOTS, AdSpot, SaveAdParams } from './interfaces';

/** An ad's details as saved: the form's fields plus its checked tap action. */
export type StoredAdParams = SaveAdParams & AdActionColumns;

function actionValues(params: StoredAdParams): unknown[] {
  return [
    params.actionType,
    params.actionLatitude,
    params.actionLongitude,
    params.actionPlace,
    params.promotedId,
    params.promotedName,
    params.promoteMobile,
  ];
}

// SET list for the action columns, starting at parameter $from.
function actionSets(from: number): string {
  return ['action_type', 'action_latitude', 'action_longitude', 'action_place', 'promoted_id', 'promoted_name', 'promote_mobile']
    .map((column, i) => `${column} = $${from + i}`)
    .join(', ');
}

// Ads run by the India calendar day, whatever timezone the server is in.
const TODAY = `(now() AT TIME ZONE 'Asia/Kolkata')::date`;

const STATUS_SQL = `CASE
  WHEN a.deleted_at IS NOT NULL THEN 'deleted'
  WHEN a.review_status = 'pending' AND a.needs_payment AND a.payment_method = 'pending' THEN 'unpaid'
  WHEN a.review_status = 'pending' THEN 'in_review'
  WHEN a.review_status = 'rejected' THEN 'rejected'
  WHEN ${TODAY} < a.start_date THEN 'scheduled'
  WHEN ${TODAY} > a.end_date THEN 'ended'
  ELSE 'running' END`;

// Great-circle distance in metres from the viewer ($2/$3) to the ad's place, same formula as
// the workers/problems repositories.
const DISTANCE_SQL = `(6371000 * acos(LEAST(1.0, GREATEST(-1.0,
  cos(radians($2)) * cos(radians(a.latitude)) * cos(radians(a.longitude) - radians($3)) + sin(radians($2)) * sin(radians(a.latitude))
))))`;

// Dates as plain text: pg would otherwise turn a DATE into a JS Date at local midnight.
const AD_COLUMNS = `a.*, ${STATUS_SQL} AS status,
  to_char(a.start_date, 'YYYY-MM-DD') AS start_date_text,
  to_char(a.end_date, 'YYYY-MM-DD') AS end_date_text`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAd(row: any): Ad {
  return {
    id: row.id,
    billNumber: Number(row.bill_number),
    advertiserName: row.advertiser_name,
    advertiserPhone: row.advertiser_phone,
    // The Call button uses the business phone.
    contactPhone: row.advertiser_phone,
    title: row.title,
    description: row.description,
    imageUrl: row.image_urls?.[0] ?? null,
    imageUrls: row.image_urls ?? [],
    videoUrl: row.video_url,
    locationText: row.location_text,
    linkUrl: row.link_url ?? null,
    actionType: row.action_type ?? 'none',
    destination:
      row.action_type === 'location' && row.action_latitude != null
        ? { latitude: Number(row.action_latitude), longitude: Number(row.action_longitude), name: row.action_place ?? '' }
        : null,
    promoted:
      ['service', 'business', 'job_post'].includes(row.action_type) && row.promoted_id
        ? { kind: row.action_type, id: row.promoted_id, name: row.promoted_name ?? '' }
        : null,
    promoteMobile: row.promote_mobile ?? null,
    needsPayment: !!row.needs_payment,
    razorpayOrderId: row.razorpay_order_id ?? null,
    razorpayPaymentId: row.razorpay_payment_id ?? null,
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
    refundId: row.refund_id ?? null,
    refundedAt: row.refunded_at ? new Date(row.refunded_at).toISOString() : null,
    orientation: row.orientation,
    displaySeconds: Number(row.display_seconds),
    videoSeconds: row.video_seconds == null ? null : Number(row.video_seconds),
    durationSeconds: row.video_url ? Math.max(1, Math.ceil(Number(row.video_seconds ?? 15))) : Number(row.display_seconds),
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    radiusKm: Number(row.radius_km),
    planDays: Number(row.plan_days) as Ad['planDays'],
    amount: Number(row.amount),
    paymentMethod: row.payment_method,
    startDate: row.start_date_text,
    endDate: row.end_date_text,
    ownerAccountId: row.owner_account_id ?? null,
    reviewStatus: row.review_status,
    reviewNote: row.review_note ?? null,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    impressions: Number(row.impressions),
    clicks: Number(row.clicks),
    status: row.status as AdStatus,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSettings(row: any): AdSettings {
  return {
    adsEnabled: row.ads_enabled,
    launchUser: row.launch_user,
    launchPartner: row.launch_partner,
    actionUser: row.action_user,
    actionPartner: row.action_partner,
    // A spot not saved yet is on.
    spots: Object.fromEntries(AD_SPOTS.map((spot) => [spot, row.action_spots?.[spot] !== false])) as Record<AdSpot, boolean>,
    actionGapSeconds: Number(row.action_gap_seconds ?? 0),
    prices: {
      '1': Number(row.plan_prices['1']),
      '3': Number(row.plan_prices['3']),
      '7': Number(row.plan_prices['7']),
      '30': Number(row.plan_prices['30']),
    },
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const SETTINGS_COLUMNS: Record<keyof Omit<AdSettings, 'updatedAt' | 'prices' | 'spots' | 'actionGapSeconds'>, string> = {
  adsEnabled: 'ads_enabled',
  launchUser: 'launch_user',
  launchPartner: 'launch_partner',
  actionUser: 'action_user',
  actionPartner: 'action_partner',
};

export class AdsRepository {
  constructor(private readonly pool: Pool) {}

  async getSettings(): Promise<AdSettings> {
    const result = await this.pool.query(`SELECT * FROM ad_settings WHERE id = 1`);
    return mapSettings(result.rows[0]);
  }

  async updateSettings(changes: Partial<Omit<AdSettings, 'updatedAt'>>): Promise<AdSettings> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (changes.prices) {
      values.push(JSON.stringify(changes.prices));
      sets.push(`plan_prices = $${values.length}::jsonb`);
    }
    if (changes.spots) {
      // Merged, so saving one switch never resets the others.
      values.push(JSON.stringify(changes.spots));
      sets.push(`action_spots = action_spots || $${values.length}::jsonb`);
    }
    if (typeof changes.actionGapSeconds === 'number') {
      values.push(changes.actionGapSeconds);
      sets.push(`action_gap_seconds = $${values.length}`);
    }
    for (const [key, column] of Object.entries(SETTINGS_COLUMNS)) {
      const value = changes[key as keyof typeof SETTINGS_COLUMNS];
      if (typeof value === 'boolean') {
        values.push(value);
        sets.push(`${column} = $${values.length}`);
      }
    }
    if (sets.length === 0) return this.getSettings();
    const result = await this.pool.query(
      `UPDATE ad_settings SET ${sets.join(', ')}, updated_at = now() WHERE id = 1 RETURNING *`,
      values,
    );
    return mapSettings(result.rows[0]);
  }

  /**
   * Books an ad. With `ownerAccountId` it's a business booking its own ad: it waits for review
   * and its payment is 'pending'; without it, the admin's booking (approved at once).
   */
  async create(params: StoredAdParams, amount: number, ownerAccountId: string | null = null): Promise<Ad> {
    const result = await this.pool.query(
      `WITH inserted AS (
         INSERT INTO ads (advertiser_name, advertiser_phone, title, description, latitude, longitude, location_text,
                          plan_days, amount, payment_method, start_date, end_date, link_url, orientation, display_seconds,
                          owner_account_id, review_status, needs_payment, action_type, action_latitude, action_longitude, action_place, promoted_id, promoted_name, promote_mobile)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date, $11::date + ($8::int - 1), $12, $13, $14,
                 $15, CASE WHEN $15::uuid IS NULL THEN 'approved' ELSE 'pending' END, $15::uuid IS NOT NULL, $16, $17, $18, $19, $20, $21, $22)
         RETURNING *
       )
       SELECT ${AD_COLUMNS} FROM inserted a`,
      [
        params.advertiserName,
        params.advertiserPhone ?? null,
        params.title,
        params.description ?? null,
        params.latitude,
        params.longitude,
        params.locationText,
        params.planDays,
        amount,
        params.paymentMethod,
        params.startDate,
        params.linkUrl ?? null,
        params.orientation,
        params.displaySeconds,
        ownerAccountId,
        ...actionValues(params),
      ],
    );
    return mapAd(result.rows[0]);
  }

  /**
   * A business editing its own ad while it waits for review or after it was rejected: the
   * changes go back for review.
   */
  async updateOwned(id: string, ownerAccountId: string, params: StoredAdParams, amount: number): Promise<Ad | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE ads SET advertiser_name = $3, advertiser_phone = $4, title = $5, description = $6,
           latitude = $7, longitude = $8, location_text = $9, plan_days = $10, amount = $11,
           start_date = $12::date, end_date = $12::date + ($10::int - 1), link_url = $13, orientation = $14, display_seconds = $15,
           review_status = 'pending', review_note = NULL, reviewed_at = NULL, ${actionSets(16)}, updated_at = now()
         WHERE id = $1 AND owner_account_id = $2 AND deleted_at IS NULL AND review_status IN ('pending', 'rejected')
         RETURNING *
       )
       SELECT ${AD_COLUMNS} FROM updated a`,
      [
        id,
        ownerAccountId,
        params.advertiserName,
        params.advertiserPhone ?? null,
        params.title,
        params.description ?? null,
        params.latitude,
        params.longitude,
        params.locationText,
        params.planDays,
        amount,
        params.startDate,
        params.linkUrl ?? null,
        params.orientation,
        params.displaySeconds,
        ...actionValues(params),
      ],
    );
    return result.rows[0] ? mapAd(result.rows[0]) : null;
  }

  /** One business's own ads, newest first. */
  async listOwned(ownerAccountId: string): Promise<Ad[]> {
    const result = await this.pool.query(
      `SELECT ${AD_COLUMNS} FROM ads a WHERE a.owner_account_id = $1 ORDER BY a.created_at DESC LIMIT 100`,
      [ownerAccountId],
    );
    return result.rows.map(mapAd);
  }

  /** Ads this business has waiting for review or rejected (not withdrawn). */
  async countOpenOwned(ownerAccountId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT count(*)::int AS n FROM ads
       WHERE owner_account_id = $1 AND deleted_at IS NULL AND review_status IN ('pending', 'rejected')`,
      [ownerAccountId],
    );
    return result.rows[0].n;
  }

  /** The business takes back an ad that wasn't approved (it stays in their history). */
  async withdrawOwned(id: string, ownerAccountId: string): Promise<Ad | null> {
    const result = await this.pool.query(
      `WITH deleted AS (
         UPDATE ads SET deleted_at = now(), updated_at = now()
         WHERE id = $1 AND owner_account_id = $2 AND deleted_at IS NULL AND review_status IN ('pending', 'rejected')
         RETURNING *
       )
       SELECT ${AD_COLUMNS} FROM deleted a`,
      [id, ownerAccountId],
    );
    return result.rows[0] ? mapAd(result.rows[0]) : null;
  }

  /**
   * The admin's decision on an ad waiting for review. Approving needs its dates still ahead
   * (an ad whose end date has passed can't run — the business changes the dates and resubmits).
   */
  async review(id: string, decision: 'approve' | 'reject', note: string | null): Promise<Ad | null> {
    const result = await this.pool.query(
      `WITH reviewed AS (
         UPDATE ads SET review_status = $2, review_note = $3, reviewed_at = now(), updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL AND review_status = 'pending'
           AND ($2 = 'rejected' OR (end_date >= ${TODAY} AND NOT (needs_payment AND payment_method = 'pending')))
         RETURNING *
       )
       SELECT ${AD_COLUMNS} FROM reviewed a`,
      [id, decision === 'approve' ? 'approved' : 'rejected', note],
    );
    return result.rows[0] ? mapAd(result.rows[0]) : null;
  }

  /** Remembers the Razorpay order a payment for this ad is being made against. */
  async setOrder(id: string, orderId: string): Promise<void> {
    await this.pool.query(`UPDATE ads SET razorpay_order_id = $2, updated_at = now() WHERE id = $1`, [id, orderId]);
  }

  /** Records the online payment; null when the ad was already paid (or isn't waiting for it). */
  async markPaidOnline(id: string, orderId: string, paymentId: string): Promise<Ad | null> {
    const result = await this.pool.query(
      `WITH paid AS (
         UPDATE ads SET payment_method = 'online', razorpay_payment_id = $3, paid_at = now(), updated_at = now()
         WHERE id = $1 AND razorpay_order_id = $2 AND payment_method = 'pending' AND deleted_at IS NULL
         RETURNING *
       )
       SELECT ${AD_COLUMNS} FROM paid a`,
      [id, orderId, paymentId],
    );
    return result.rows[0] ? mapAd(result.rows[0]) : null;
  }

  /** The online payment was refunded: the ad is unpaid again (a resubmission pays anew). */
  async markRefunded(id: string, refundId: string): Promise<Ad | null> {
    const result = await this.pool.query(
      `WITH refunded AS (
         UPDATE ads SET payment_method = 'pending', refund_id = $2, refunded_at = now(),
           razorpay_payment_id = NULL, razorpay_order_id = NULL, paid_at = NULL, updated_at = now()
         WHERE id = $1 AND payment_method = 'online'
         RETURNING *
       )
       SELECT ${AD_COLUMNS} FROM refunded a`,
      [id, refundId],
    );
    return result.rows[0] ? mapAd(result.rows[0]) : null;
  }

  /** Edits a live (not deleted) ad; the end date and amount follow the plan. */
  async update(id: string, params: StoredAdParams, amount: number): Promise<Ad | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE ads SET advertiser_name = $2, advertiser_phone = $3, title = $4, description = $5,
           latitude = $6, longitude = $7, location_text = $8, plan_days = $9, amount = $10,
           payment_method = CASE WHEN payment_method = 'online' THEN 'online' ELSE $11 END,
           start_date = $12::date, end_date = $12::date + ($9::int - 1), link_url = $13, orientation = $14, display_seconds = $15, ${actionSets(16)}, updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *
       )
       SELECT ${AD_COLUMNS} FROM updated a`,
      [
        id,
        params.advertiserName,
        params.advertiserPhone ?? null,
        params.title,
        params.description ?? null,
        params.latitude,
        params.longitude,
        params.locationText,
        params.planDays,
        amount,
        params.paymentMethod,
        params.startDate,
        params.linkUrl ?? null,
        params.orientation,
        params.displaySeconds,
        ...actionValues(params),
      ],
    );
    return result.rows[0] ? mapAd(result.rows[0]) : null;
  }

  async findById(id: string): Promise<Ad | null> {
    const result = await this.pool.query(`SELECT ${AD_COLUMNS} FROM ads a WHERE a.id = $1`, [id]);
    return result.rows[0] ? mapAd(result.rows[0]) : null;
  }

  /** Sets a live ad's images and video; returns the ad and the media it had before. */
  async setMedia(
    id: string,
    imageUrls: string[],
    videoUrl: string | null,
    videoSeconds: number | null,
  ): Promise<{ ad: Ad; previousImages: string[]; previousVideo: string | null } | null> {
    const result = await this.pool.query(
      // The old values come from a FROM-subquery (read before the update), not a separate CTE:
      // a FOR UPDATE CTE skips the row this same statement updates, which returned nothing.
      `WITH updated AS (
         UPDATE ads a SET image_urls = $2, video_url = $3, video_seconds = $4, updated_at = now()
         FROM (SELECT image_urls AS previous_images, video_url AS previous_video
               FROM ads WHERE id = $1 AND deleted_at IS NULL FOR UPDATE) old
         WHERE a.id = $1 AND a.deleted_at IS NULL
         RETURNING a.*, old.previous_images, old.previous_video
       )
       SELECT ${AD_COLUMNS} FROM updated a`,
      [id, imageUrls, videoUrl, videoSeconds],
    );
    const row = result.rows[0];
    return row ? { ad: mapAd(row), previousImages: row.previous_images ?? [], previousVideo: row.previous_video } : null;
  }

  /** Ads that are over (ended or deleted) but still hold media. */
  async findFinishedWithMedia(limit = 50): Promise<{ id: string; imageUrls: string[]; videoUrl: string | null }[]> {
    const result = await this.pool.query(
      `SELECT id, image_urls, video_url FROM ads
       WHERE (deleted_at IS NOT NULL OR end_date < ${TODAY})
         AND (cardinality(image_urls) > 0 OR video_url IS NOT NULL)
       LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => ({ id: row.id, imageUrls: row.image_urls ?? [], videoUrl: row.video_url }));
  }

  /** Every image and video address any ad (live, ended or deleted) still points to. */
  async allMediaUrls(): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT unnest(image_urls) AS url FROM ads UNION ALL SELECT video_url FROM ads WHERE video_url IS NOT NULL`,
    );
    return result.rows.map((row) => row.url);
  }

  /** Forgets an ad's media once its files are gone from Cloudinary. */
  async clearMedia(id: string): Promise<void> {
    await this.pool.query(`UPDATE ads SET image_urls = '{}', video_url = NULL, media_cleared_at = now() WHERE id = $1`, [id]);
  }

  /** Stops an ad for good; it stays in the history with its bill. */
  async softDelete(id: string): Promise<Ad | null> {
    const result = await this.pool.query(
      `WITH deleted AS (
         UPDATE ads SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING *
       )
       SELECT ${AD_COLUMNS} FROM deleted a`,
      [id],
    );
    return result.rows[0] ? mapAd(result.rows[0]) : null;
  }

  async list(filter: AdListFilter): Promise<{ items: Ad[]; total: number }> {
    const where: string[] = [];
    const values: unknown[] = [];
    if (filter.status) {
      values.push(filter.status);
      where.push(`(${STATUS_SQL}) = $${values.length}`);
    }
    if (filter.q) {
      values.push(`%${filter.q}%`);
      where.push(
        `(a.advertiser_name ILIKE $${values.length} OR a.title ILIKE $${values.length} OR a.bill_number::text ILIKE $${values.length})`,
      );
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.pool.query(`SELECT count(*)::int AS total FROM ads a ${whereSql}`, values);
    values.push(filter.limit, (filter.page - 1) * filter.limit);
    const result = await this.pool.query(
      `SELECT ${AD_COLUMNS} FROM ads a ${whereSql}
       ORDER BY a.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return { items: result.rows.map(mapAd), total: count.rows[0].total };
  }

  async summary(): Promise<{ counts: Record<AdStatus, number>; revenueTotal: number; revenueThisMonth: number }> {
    const result = await this.pool.query(
      // Revenue counts only approved ads whose payment was recorded.
      `SELECT
         count(*) FILTER (WHERE status = 'unpaid')::int AS unpaid,
         count(*) FILTER (WHERE status = 'in_review')::int AS in_review,
         count(*) FILTER (WHERE status = 'rejected')::int AS rejected,
         count(*) FILTER (WHERE status = 'running')::int AS running,
         count(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
         count(*) FILTER (WHERE status = 'ended')::int AS ended,
         count(*) FILTER (WHERE status = 'deleted')::int AS deleted,
         COALESCE(sum(amount) FILTER (WHERE paid), 0)::int AS revenue_total,
         COALESCE(sum(amount) FILTER (
           WHERE paid AND date_trunc('month', created_at AT TIME ZONE 'Asia/Kolkata') = date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')
         ), 0)::int AS revenue_month
       FROM (SELECT a.amount, a.created_at, ${STATUS_SQL} AS status,
               (a.review_status = 'approved' AND a.payment_method != 'pending') AS paid
             FROM ads a) s`,
    );
    const row = result.rows[0];
    return {
      counts: {
        unpaid: row.unpaid,
        in_review: row.in_review,
        rejected: row.rejected,
        running: row.running,
        scheduled: row.scheduled,
        ended: row.ended,
        deleted: row.deleted,
      },
      revenueTotal: row.revenue_total,
      revenueThisMonth: row.revenue_month,
    };
  }

  /**
   * Picks the running ad shown fewest times today and counts the view, in one statement.
   * Every running ad therefore gets an equal share of each day's views, however many there
   * are. `excludeId` (the ad this person saw last) goes to the back of the queue, so the
   * next open shows someone else whenever more than one ad is running.
   */
  async pickAndCount(excludeId: string | null, latitude: number, longitude: number, withProfileAds = true): Promise<Ad | null> {
    const result = await this.pool.query(
      `WITH picked AS (
         SELECT a.id FROM ads a
         LEFT JOIN ad_daily_stats s ON s.ad_id = a.id AND s.day = ${TODAY}
         WHERE a.deleted_at IS NULL AND a.review_status = 'approved' AND ${TODAY} BETWEEN a.start_date AND a.end_date
           -- An ad with a place (a directions ad) is local; one without is shown everywhere.
           AND (a.latitude IS NULL OR ${DISTANCE_SQL} <= a.radius_km * 1000)
           -- Profile ads (Book Now / Order / Contact) only where they can be used.
           AND ($4::boolean OR a.action_type NOT IN ('service', 'business', 'job_post'))
         ORDER BY (a.id = $1::uuid) ASC NULLS FIRST, COALESCE(s.impressions, 0) ASC, random()
         LIMIT 1
       ),
       daily AS (
         INSERT INTO ad_daily_stats (ad_id, day, impressions)
         SELECT id, ${TODAY}, 1 FROM picked
         ON CONFLICT (ad_id, day) DO UPDATE SET impressions = ad_daily_stats.impressions + 1
       ),
       counted AS (
         UPDATE ads SET impressions = ads.impressions + 1 FROM picked WHERE ads.id = picked.id RETURNING ads.*
       )
       SELECT ${AD_COLUMNS} FROM counted a`,
      [excludeId, latitude, longitude, withProfileAds],
    );
    return result.rows[0] ? mapAd(result.rows[0]) : null;
  }

  /** Whether this person saw an ad before an action less than `gapSeconds` ago (in this app). */
  async sawActionAdWithin(accountId: string, app: AdApp, gapSeconds: number): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM ad_viewer_state
       WHERE account_id = $1 AND app = $2 AND last_action_ad_at > now() - make_interval(secs => $3)`,
      [accountId, app, gapSeconds],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async markActionAdShown(accountId: string, app: AdApp): Promise<void> {
    await this.pool.query(
      `INSERT INTO ad_viewer_state (account_id, app, last_action_ad_at) VALUES ($1, $2, now())
       ON CONFLICT (account_id, app) DO UPDATE SET last_action_ad_at = now()`,
      [accountId, app],
    );
  }

  async recordClick(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `WITH clicked AS (
         UPDATE ads SET clicks = clicks + 1 WHERE id = $1 AND deleted_at IS NULL RETURNING id
       )
       INSERT INTO ad_daily_stats (ad_id, day, clicks)
       SELECT id, ${TODAY}, 1 FROM clicked
       ON CONFLICT (ad_id, day) DO UPDATE SET clicks = ad_daily_stats.clicks + 1
       RETURNING ad_id`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
