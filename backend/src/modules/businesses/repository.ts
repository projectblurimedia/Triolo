import { Pool, QueryResultRow } from 'pg';
import { parsePgArray } from '@/common/utils/pgArray';
import {
  AdminListFilter,
  AdminListResult,
  BusinessNearbyResult,
  BusinessProfile,
  BusinessProfileWithAccount,
  NearbySearchFilter,
} from './interfaces';

function mapBusinessProfile(row: QueryResultRow): BusinessProfile {
  return {
    id: row.id,
    accountId: row.account_id,
    shopName: row.shop_name,
    shopCategories: parsePgArray(row.shop_categories) as BusinessProfile['shopCategories'],
    otherCategoryDescription: row.other_category_description,
    latitude: row.latitude,
    longitude: row.longitude,
    locationName: row.location_name ?? row.city ?? null,
    area: row.area,
    city: row.city,
    district: row.district,
    state: row.state,
    pincode: row.pincode,
    profilePhotoUrl: row.profile_photo_url ?? null,
    shopPhotoUrls: row.shop_photo_urls ?? [],
    deliveryAvailable: row.delivery_available,
    deliveryPricePerKm: row.delivery_price_per_km != null ? Number(row.delivery_price_per_km) : null,
    deliveryMinCharge: row.delivery_min_charge != null ? Number(row.delivery_min_charge) : null,
    verificationStatus: row.verification_status,
    ratingAverage: row.rating_count > 0 ? Math.round((row.rating_sum / row.rating_count) * 10) / 10 : null,
    ratingCount: row.rating_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBusinessProfileWithAccount(row: QueryResultRow): BusinessProfileWithAccount {
  return {
    ...mapBusinessProfile(row),
    accountFullName: row.account_full_name,
    accountMobileNumber: row.account_mobile_number,
    accountEmail: row.account_email,
    accountStatus: row.account_status ?? 'active',
  };
}

export class BusinessesRepository {
  constructor(private readonly pool: Pool) {}

  async findByAccountId(accountId: string): Promise<BusinessProfile | null> {
    const result = await this.pool.query('SELECT * FROM business_profiles WHERE account_id = $1', [accountId]);
    return result.rows[0] ? mapBusinessProfile(result.rows[0]) : null;
  }

  async create(params: {
    accountId: string;
    shopName: string;
    shopCategories: string[];
    otherCategoryDescription: string | null;
    latitude: number;
    longitude: number;
    locationName: string;
    area: string | null;
    city: string | null;
    district: string | null;
    state: string | null;
    pincode: string | null;
    shopPhotoUrls: string[];
    deliveryAvailable: boolean;
    deliveryPricePerKm: number | null;
    deliveryMinCharge: number | null;
  }): Promise<BusinessProfile> {
    const result = await this.pool.query(
      `INSERT INTO business_profiles (account_id, shop_name, shop_categories, other_category_description, latitude, longitude, area, city, district, state, pincode, shop_photo_urls, delivery_available, delivery_price_per_km, location_name, delivery_min_charge)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        params.accountId,
        params.shopName,
        params.shopCategories,
        params.otherCategoryDescription,
        params.latitude,
        params.longitude,
        params.area,
        params.city,
        params.district,
        params.state,
        params.pincode,
        params.shopPhotoUrls,
        params.deliveryAvailable,
        params.deliveryPricePerKm,
        params.locationName,
        params.deliveryMinCharge,
      ],
    );
    return mapBusinessProfile(result.rows[0]);
  }

  async update(
    accountId: string,
    params: {
      shopName: string;
      shopCategories: string[];
      otherCategoryDescription: string | null;
      latitude: number;
      longitude: number;
      locationName: string;
      area: string | null;
      city: string | null;
      district: string | null;
      state: string | null;
      pincode: string | null;
      shopPhotoUrls: string[];
      deliveryAvailable: boolean;
      deliveryPricePerKm: number | null;
      deliveryMinCharge: number | null;
      verificationStatus: string;
    },
  ): Promise<BusinessProfile> {
    const result = await this.pool.query(
      `UPDATE business_profiles
       SET shop_name = $2, shop_categories = $3, other_category_description = $4, latitude = $5, longitude = $6, area = $7, city = $8, district = $9, state = $10, pincode = $11, shop_photo_urls = $12, delivery_available = $13, delivery_price_per_km = $14, verification_status = $15, location_name = $16, delivery_min_charge = $17, updated_at = now()
       WHERE account_id = $1
       RETURNING *`,
      [
        accountId,
        params.shopName,
        params.shopCategories,
        params.otherCategoryDescription,
        params.latitude,
        params.longitude,
        params.area,
        params.city,
        params.district,
        params.state,
        params.pincode,
        params.shopPhotoUrls,
        params.deliveryAvailable,
        params.deliveryPricePerKm,
        params.verificationStatus,
        params.locationName,
        params.deliveryMinCharge,
      ],
    );
    return mapBusinessProfile(result.rows[0]);
  }

  /** Sets (or clears) the profile photo; returns the profile and the photo it replaced, or null with no profile. */
  async setProfilePhoto(
    accountId: string,
    photoUrl: string | null,
  ): Promise<{ profile: BusinessProfile; previousUrl: string | null } | null> {
    const result = await this.pool.query(
      `UPDATE business_profiles p SET profile_photo_url = $2, updated_at = now()
       FROM (SELECT profile_photo_url AS previous_url FROM business_profiles WHERE account_id = $1 FOR UPDATE) old
       WHERE p.account_id = $1
       RETURNING p.*, old.previous_url`,
      [accountId, photoUrl],
    );
    if (!result.rows[0]) return null;
    return { profile: mapBusinessProfile(result.rows[0]), previousUrl: result.rows[0].previous_url ?? null };
  }

  async remove(accountId: string): Promise<void> {
    await this.pool.query('DELETE FROM business_profiles WHERE account_id = $1', [accountId]);
  }

  // --- Admin-facing (see modules/admin) — same rationale as WorkersRepository's own
  // equivalent section: a same-module join against `accounts`, not a cross-module reach.

  async findAll(filter: AdminListFilter): Promise<AdminListResult<BusinessProfileWithAccount>> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter.status) {
      params.push(filter.status);
      conditions.push(`b.verification_status = $${params.length}`);
    }
    if (filter.q) {
      params.push(`%${filter.q}%`);
      conditions.push(
        `(a.full_name ILIKE $${params.length} OR a.mobile_number ILIKE $${params.length} OR b.shop_name ILIKE $${params.length})`,
      );
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM business_profiles b JOIN accounts a ON a.id = b.account_id ${whereClause}`,
      params,
    );
    const total = Number(countResult.rows[0].count);

    const offset = (filter.page - 1) * filter.limit;
    params.push(filter.limit, offset);
    const rows = await this.pool.query(
      `SELECT b.*, a.full_name AS account_full_name, a.mobile_number AS account_mobile_number, a.email AS account_email,
              a.status AS account_status
       FROM business_profiles b
       JOIN accounts a ON a.id = b.account_id
       ${whereClause}
       ORDER BY b.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items: rows.rows.map(mapBusinessProfileWithAccount), total, page: filter.page, limit: filter.limit };
  }

  /** Adds one 1–5 star rating to the shop's running total (see migration 0021). */
  async recordRating(id: string, stars: number): Promise<void> {
    await this.pool.query(
      `UPDATE business_profiles SET rating_sum = rating_sum + $2, rating_count = rating_count + 1 WHERE id = $1`,
      [id, stars],
    );
  }

  /** Verified shops by id, for a customer's favorites list. */
  async findVerifiedByIds(ids: string[]): Promise<BusinessProfile[]> {
    if (ids.length === 0) return [];
    const result = await this.pool.query(
      `SELECT * FROM business_profiles WHERE id = ANY($1::uuid[]) AND verification_status = 'verified'`,
      [ids],
    );
    return result.rows.map(mapBusinessProfile);
  }

  async findById(id: string): Promise<BusinessProfileWithAccount | null> {
    const result = await this.pool.query(
      `SELECT b.*, a.full_name AS account_full_name, a.mobile_number AS account_mobile_number, a.email AS account_email,
              a.status AS account_status
       FROM business_profiles b
       JOIN accounts a ON a.id = b.account_id
       WHERE b.id = $1`,
      [id],
    );
    return result.rows[0] ? mapBusinessProfileWithAccount(result.rows[0]) : null;
  }

  async updateVerificationStatus(id: string, status: string): Promise<BusinessProfile | null> {
    const result = await this.pool.query(
      `UPDATE business_profiles SET verification_status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, status],
    );
    return result.rows[0] ? mapBusinessProfile(result.rows[0]) : null;
  }

  // --- Public nearby-search — same Haversine-in-SQL approach as WorkersRepository.findNearby,
  // see that method's own doc comment for the acos() domain-clamp rationale.
  async findNearby(excludeAccountId: string, filter: NearbySearchFilter): Promise<BusinessNearbyResult[]> {
    const like = filter.query ? `%${filter.query}%` : null;
    // 'rating': best average first (unrated shops last), more ratings then distance breaking ties.
    const orderBy =
      filter.sort === 'rating'
        ? `CASE WHEN sub.rating_count > 0 THEN sub.rating_sum::float / sub.rating_count END DESC NULLS LAST,
           sub.rating_count DESC, sub.distance_meters ASC`
        : 'sub.distance_meters ASC';
    const result = await this.pool.query(
      `SELECT * FROM (
         SELECT b.*, a.full_name AS account_full_name, a.mobile_number AS account_mobile_number, a.email AS account_email,
           (6371000 * acos(LEAST(1.0, GREATEST(-1.0,
             cos(radians($1)) * cos(radians(b.latitude)) * cos(radians(b.longitude) - radians($2)) + sin(radians($1)) * sin(radians(b.latitude))
           )))) AS distance_meters
         FROM business_profiles b
         JOIN accounts a ON a.id = b.account_id
         WHERE b.verification_status = 'verified' AND a.status = 'active'
           AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL
           AND b.account_id != $3
       ) sub
       WHERE sub.distance_meters <= $4
         AND ($5::text IS NULL OR ${filter.nameOnly ? 'sub.shop_name ILIKE $5' : "sub.shop_name ILIKE $5 OR sub.other_category_description ILIKE $5 OR sub.location_name ILIKE $5 OR sub.city ILIKE $5 OR sub.area ILIKE $5 OR array_to_string(sub.shop_categories, ',') ILIKE $5"})
         AND ($7::business_shop_category[] IS NULL OR sub.shop_categories && $7::business_shop_category[])
         AND ($8::boolean IS NOT TRUE OR sub.delivery_available)
       ORDER BY (sub.account_id = ANY($9::uuid[])) DESC, ${orderBy}
       LIMIT $6`,
      [
        filter.latitude,
        filter.longitude,
        excludeAccountId,
        filter.radiusKm * 1000,
        like,
        filter.limit,
        filter.shopCategory ? filter.shopCategory.split(',') : null,
        filter.deliveryOnly ?? false,
        filter.priorityAccountIds ?? [],
      ],
    );
    return result.rows.map((row) => ({ ...mapBusinessProfile(row), distanceMeters: Number(row.distance_meters) }));
  }

  /** Profile counts by verification state, for the admin dashboard. */
  async adminCounts(): Promise<{ total: number; pending: number; verified: number; rejected: number }> {
    const result = await this.pool.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE verification_status = 'pending_verification') AS pending,
              COUNT(*) FILTER (WHERE verification_status = 'verified') AS verified,
              COUNT(*) FILTER (WHERE verification_status = 'rejected') AS rejected
       FROM business_profiles`,
    );
    const row = result.rows[0];
    return {
      total: Number(row.total),
      pending: Number(row.pending),
      verified: Number(row.verified),
      rejected: Number(row.rejected),
    };
  }

  async findCustomCategories(query: string): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT ON (lower(name)) name FROM (
         SELECT trim(unnest(string_to_array(other_category_description, ','))) AS name
         FROM business_profiles
         WHERE verification_status = 'verified' AND other_category_description IS NOT NULL
       ) s
       WHERE name <> '' AND name ILIKE $1
       ORDER BY lower(name)
       LIMIT 15`,
      [`%${query}%`],
    );
    return result.rows.map((row) => row.name);
  }
}
