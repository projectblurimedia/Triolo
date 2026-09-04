import { Pool, QueryResultRow } from 'pg';
import { parsePgArray } from '@/common/utils/pgArray';
import { AdminListFilter, AdminListResult, WorkerProfile, WorkerProfileWithAccount } from './interfaces';

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

function mapWorkerProfileWithAccount(row: QueryResultRow): WorkerProfileWithAccount {
  return {
    ...mapWorkerProfile(row),
    accountFullName: row.account_full_name,
    accountMobileNumber: row.account_mobile_number,
    accountEmail: row.account_email,
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

  // --- Admin-facing (see modules/admin) — reads joined against `accounts` for review
  // context. This is a same-module query against a FK-related table, not a reach into
  // another module's repository; the module-boundary rule is about *services* calling
  // each other, which `admin` does (see AdminService) — it never queries this table itself.

  async findAll(filter: AdminListFilter): Promise<AdminListResult<WorkerProfileWithAccount>> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter.status) {
      params.push(filter.status);
      conditions.push(`w.verification_status = $${params.length}`);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.pool.query(`SELECT COUNT(*) FROM worker_profiles w ${whereClause}`, params);
    const total = Number(countResult.rows[0].count);

    const offset = (filter.page - 1) * filter.limit;
    params.push(filter.limit, offset);
    const rows = await this.pool.query(
      `SELECT w.*, a.full_name AS account_full_name, a.mobile_number AS account_mobile_number, a.email AS account_email
       FROM worker_profiles w
       JOIN accounts a ON a.id = w.account_id
       ${whereClause}
       ORDER BY w.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items: rows.rows.map(mapWorkerProfileWithAccount), total, page: filter.page, limit: filter.limit };
  }

  async findById(id: string): Promise<WorkerProfileWithAccount | null> {
    const result = await this.pool.query(
      `SELECT w.*, a.full_name AS account_full_name, a.mobile_number AS account_mobile_number, a.email AS account_email
       FROM worker_profiles w
       JOIN accounts a ON a.id = w.account_id
       WHERE w.id = $1`,
      [id],
    );
    return result.rows[0] ? mapWorkerProfileWithAccount(result.rows[0]) : null;
  }

  async updateVerificationStatus(id: string, status: string): Promise<WorkerProfile | null> {
    const result = await this.pool.query(
      `UPDATE worker_profiles SET verification_status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, status],
    );
    return result.rows[0] ? mapWorkerProfile(result.rows[0]) : null;
  }
}
