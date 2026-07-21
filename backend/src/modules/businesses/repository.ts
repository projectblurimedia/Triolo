import { Pool, QueryResultRow } from 'pg';
import { BusinessProfile } from './interfaces';

function mapBusinessProfile(row: QueryResultRow): BusinessProfile {
  return {
    id: row.id,
    accountId: row.account_id,
    shopName: row.shop_name,
    shopCategory: row.shop_category,
    latitude: row.latitude,
    longitude: row.longitude,
    locationAddress: row.location_address,
    shopPhotoUrls: row.shop_photo_urls ?? [],
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
    shopCategory: string;
    latitude: number | null;
    longitude: number | null;
    locationAddress: string | null;
    shopPhotoUrls: string[];
  }): Promise<BusinessProfile> {
    const result = await this.pool.query(
      `INSERT INTO business_profiles (account_id, shop_name, shop_category, latitude, longitude, location_address, shop_photo_urls)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        params.accountId,
        params.shopName,
        params.shopCategory,
        params.latitude,
        params.longitude,
        params.locationAddress,
        params.shopPhotoUrls,
      ],
    );
    return mapBusinessProfile(result.rows[0]);
  }
}
