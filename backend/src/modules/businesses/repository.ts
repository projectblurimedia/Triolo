import { Pool, QueryResultRow } from 'pg';
import { parsePgArray } from '@/common/utils/pgArray';
import { AdminListFilter, AdminListResult, BusinessProfile, BusinessProfileWithAccount } from './interfaces';

function mapBusinessProfile(row: QueryResultRow): BusinessProfile {
  return {
    id: row.id,
    accountId: row.account_id,
    shopName: row.shop_name,
    shopCategories: parsePgArray(row.shop_categories) as BusinessProfile['shopCategories'],
    otherCategoryDescription: row.other_category_description,
    latitude: row.latitude,
    longitude: row.longitude,
    area: row.area,
    city: row.city,
    district: row.district,
    state: row.state,
    pincode: row.pincode,
    shopPhotoUrls: row.shop_photo_urls ?? [],
    deliveryAvailable: row.delivery_available,
    deliveryPricePerKm: row.delivery_price_per_km,
    verificationStatus: row.verification_status,
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
    latitude: number | null;
    longitude: number | null;
    area: string | null;
    city: string;
    district: string;
    state: string;
    pincode: string;
    shopPhotoUrls: string[];
    deliveryAvailable: boolean;
    deliveryPricePerKm: number | null;
  }): Promise<BusinessProfile> {
    const result = await this.pool.query(
      `INSERT INTO business_profiles (account_id, shop_name, shop_categories, other_category_description, latitude, longitude, area, city, district, state, pincode, shop_photo_urls, delivery_available, delivery_price_per_km)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
      latitude: number | null;
      longitude: number | null;
      area: string | null;
      city: string;
      district: string;
      state: string;
      pincode: string;
      shopPhotoUrls: string[];
      deliveryAvailable: boolean;
      deliveryPricePerKm: number | null;
      verificationStatus: string;
    },
  ): Promise<BusinessProfile> {
    const result = await this.pool.query(
      `UPDATE business_profiles
       SET shop_name = $2, shop_categories = $3, other_category_description = $4, latitude = $5, longitude = $6, area = $7, city = $8, district = $9, state = $10, pincode = $11, shop_photo_urls = $12, delivery_available = $13, delivery_price_per_km = $14, verification_status = $15, updated_at = now()
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
      ],
    );
    return mapBusinessProfile(result.rows[0]);
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
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.pool.query(`SELECT COUNT(*) FROM business_profiles b ${whereClause}`, params);
    const total = Number(countResult.rows[0].count);

    const offset = (filter.page - 1) * filter.limit;
    params.push(filter.limit, offset);
    const rows = await this.pool.query(
      `SELECT b.*, a.full_name AS account_full_name, a.mobile_number AS account_mobile_number, a.email AS account_email
       FROM business_profiles b
       JOIN accounts a ON a.id = b.account_id
       ${whereClause}
       ORDER BY b.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items: rows.rows.map(mapBusinessProfileWithAccount), total, page: filter.page, limit: filter.limit };
  }

  async findById(id: string): Promise<BusinessProfileWithAccount | null> {
    const result = await this.pool.query(
      `SELECT b.*, a.full_name AS account_full_name, a.mobile_number AS account_mobile_number, a.email AS account_email
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
}
