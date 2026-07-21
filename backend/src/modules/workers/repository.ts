import { Pool, QueryResultRow } from 'pg';
import { WorkerProfile } from './interfaces';

function mapWorkerProfile(row: QueryResultRow): WorkerProfile {
  return {
    id: row.id,
    accountId: row.account_id,
    skillCategory: row.skill_category,
    experienceYears: row.experience_years,
    latitude: row.latitude,
    longitude: row.longitude,
    locationAddress: row.location_address,
    portfolioPhotoUrls: row.portfolio_photo_urls ?? [],
    verificationStatus: row.verification_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class WorkersRepository {
  constructor(private readonly pool: Pool) {}

  async findByAccountId(accountId: string): Promise<WorkerProfile | null> {
    const result = await this.pool.query('SELECT * FROM worker_profiles WHERE account_id = $1', [accountId]);
    return result.rows[0] ? mapWorkerProfile(result.rows[0]) : null;
  }

  async create(params: {
    accountId: string;
    skillCategory: string;
    experienceYears: number;
    latitude: number | null;
    longitude: number | null;
    locationAddress: string | null;
    portfolioPhotoUrls: string[];
  }): Promise<WorkerProfile> {
    const result = await this.pool.query(
      `INSERT INTO worker_profiles (account_id, skill_category, experience_years, latitude, longitude, location_address, portfolio_photo_urls)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        params.accountId,
        params.skillCategory,
        params.experienceYears,
        params.latitude,
        params.longitude,
        params.locationAddress,
        params.portfolioPhotoUrls,
      ],
    );
    return mapWorkerProfile(result.rows[0]);
  }
}
