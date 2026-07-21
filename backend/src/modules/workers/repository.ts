import { Pool, QueryResultRow } from 'pg';
import { parsePgArray } from '@/common/utils/pgArray';
import { WorkerProfile } from './interfaces';

function mapWorkerProfile(row: QueryResultRow): WorkerProfile {
  return {
    id: row.id,
    accountId: row.account_id,
    skillCategories: parsePgArray(row.skill_categories) as WorkerProfile['skillCategories'],
    otherSkillDescription: row.other_skill_description,
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
    skillCategories: string[];
    otherSkillDescription: string | null;
    experienceYears: number;
    latitude: number | null;
    longitude: number | null;
    locationAddress: string | null;
    portfolioPhotoUrls: string[];
  }): Promise<WorkerProfile> {
    const result = await this.pool.query(
      `INSERT INTO worker_profiles (account_id, skill_categories, other_skill_description, experience_years, latitude, longitude, location_address, portfolio_photo_urls)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        params.accountId,
        params.skillCategories,
        params.otherSkillDescription,
        params.experienceYears,
        params.latitude,
        params.longitude,
        params.locationAddress,
        params.portfolioPhotoUrls,
      ],
    );
    return mapWorkerProfile(result.rows[0]);
  }

  async update(
    accountId: string,
    params: {
      skillCategories: string[];
      otherSkillDescription: string | null;
      experienceYears: number;
      latitude: number | null;
      longitude: number | null;
      locationAddress: string | null;
      portfolioPhotoUrls: string[];
      verificationStatus: string;
    },
  ): Promise<WorkerProfile> {
    const result = await this.pool.query(
      `UPDATE worker_profiles
       SET skill_categories = $2, other_skill_description = $3, experience_years = $4, latitude = $5, longitude = $6, location_address = $7, portfolio_photo_urls = $8, verification_status = $9, updated_at = now()
       WHERE account_id = $1
       RETURNING *`,
      [
        accountId,
        params.skillCategories,
        params.otherSkillDescription,
        params.experienceYears,
        params.latitude,
        params.longitude,
        params.locationAddress,
        params.portfolioPhotoUrls,
        params.verificationStatus,
      ],
    );
    return mapWorkerProfile(result.rows[0]);
  }

  async remove(accountId: string): Promise<void> {
    await this.pool.query('DELETE FROM worker_profiles WHERE account_id = $1', [accountId]);
  }
}
