import { Pool, QueryResultRow } from 'pg';
import { parsePgArray } from '@/common/utils/pgArray';
import { BusinessProfile } from './interfaces';

function mapBusinessProfile(row: QueryResultRow): BusinessProfile {
  return {
    id: row.id,
    accountId: row.account_id,
    shopName: row.shop_name,
    shopCategories: parsePgArray(row.shop_categories) as BusinessProfile['shopCategories'],
    otherCategoryDescription: row.other_category_description,
    latitude: row.latitude,
    longitude: row.longitude,
    locationAddress: row.location_address,
    shopPhotoUrls: row.shop_photo_urls ?? [],
    deliveryAvailable: row.delivery_available,
    deliveryPricePerKm: row.delivery_price_per_km,
    verificationStatus: row.verification_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    locationAddress: string | null;
    shopPhotoUrls: string[];
    deliveryAvailable: boolean;
    deliveryPricePerKm: number | null;
  }): Promise<BusinessProfile> {
    const result = await this.pool.query(
      `INSERT INTO business_profiles (account_id, shop_name, shop_categories, other_category_description, latitude, longitude, location_address, shop_photo_urls, delivery_available, delivery_price_per_km)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        params.accountId,
        params.shopName,
        params.shopCategories,
        params.otherCategoryDescription,
        params.latitude,
        params.longitude,
        params.locationAddress,
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
      locationAddress: string | null;
      shopPhotoUrls: string[];
      deliveryAvailable: boolean;
      deliveryPricePerKm: number | null;
      verificationStatus: string;
    },
  ): Promise<BusinessProfile> {
    const result = await this.pool.query(
      `UPDATE business_profiles
       SET shop_name = $2, shop_categories = $3, other_category_description = $4, latitude = $5, longitude = $6, location_address = $7, shop_photo_urls = $8, delivery_available = $9, delivery_price_per_km = $10, verification_status = $11, updated_at = now()
       WHERE account_id = $1
       RETURNING *`,
      [
        accountId,
        params.shopName,
        params.shopCategories,
        params.otherCategoryDescription,
        params.latitude,
        params.longitude,
        params.locationAddress,
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
}
