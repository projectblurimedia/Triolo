import { Pool } from 'pg';
import { Ad, AdListFilter, AdSettings, AdStatus, SaveAdParams } from './interfaces';

// Ads run by the India calendar day, whatever timezone the server is in.
const TODAY = `(now() AT TIME ZONE 'Asia/Kolkata')::date`;

const STATUS_SQL = `CASE
  WHEN a.deleted_at IS NOT NULL THEN 'deleted'
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
    prices: {
      '1': Number(row.plan_prices['1']),
      '3': Number(row.plan_prices['3']),
      '7': Number(row.plan_prices['7']),
      '30': Number(row.plan_prices['30']),
    },
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const SETTINGS_COLUMNS: Record<keyof Omit<AdSettings, 'updatedAt' | 'prices'>, string> = {
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

  async create(params: SaveAdParams, amount: number): Promise<Ad> {
    const result = await this.pool.query(
      `WITH inserted AS (
         INSERT INTO ads (advertiser_name, advertiser_phone, title, description, latitude, longitude, location_text,
                          plan_days, amount, payment_method, start_date, end_date, link_url, orientation, display_seconds)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date, $11::date + ($8::int - 1), $12, $13, $14)
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
      ],
    );
    return mapAd(result.rows[0]);
  }

  /** Edits a live (not deleted) ad; the end date and amount follow the plan. */
  async update(id: string, params: SaveAdParams, amount: number): Promise<Ad | null> {
    const result = await this.pool.query(
      `WITH updated AS (
         UPDATE ads SET advertiser_name = $2, advertiser_phone = $3, title = $4, description = $5,
           latitude = $6, longitude = $7, location_text = $8, plan_days = $9, amount = $10, payment_method = $11,
           start_date = $12::date, end_date = $12::date + ($9::int - 1), link_url = $13, orientation = $14, display_seconds = $15, updated_at = now()
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
      `SELECT
         count(*) FILTER (WHERE status = 'running')::int AS running,
         count(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
         count(*) FILTER (WHERE status = 'ended')::int AS ended,
         count(*) FILTER (WHERE status = 'deleted')::int AS deleted,
         COALESCE(sum(amount), 0)::int AS revenue_total,
         COALESCE(sum(amount) FILTER (
           WHERE date_trunc('month', created_at AT TIME ZONE 'Asia/Kolkata') = date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')
         ), 0)::int AS revenue_month
       FROM (SELECT a.amount, a.created_at, ${STATUS_SQL} AS status FROM ads a) s`,
    );
    const row = result.rows[0];
    return {
      counts: { running: row.running, scheduled: row.scheduled, ended: row.ended, deleted: row.deleted },
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
  async pickAndCount(excludeId: string | null, latitude: number, longitude: number): Promise<Ad | null> {
    const result = await this.pool.query(
      `WITH picked AS (
         SELECT a.id FROM ads a
         LEFT JOIN ad_daily_stats s ON s.ad_id = a.id AND s.day = ${TODAY}
         WHERE a.deleted_at IS NULL AND ${TODAY} BETWEEN a.start_date AND a.end_date
           AND a.latitude IS NOT NULL AND ${DISTANCE_SQL} <= a.radius_km * 1000
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
      [excludeId, latitude, longitude],
    );
    return result.rows[0] ? mapAd(result.rows[0]) : null;
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
