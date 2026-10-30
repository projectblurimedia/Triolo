import { splitSkills } from '@/modules/bookings/skills';
import { Pool, QueryResultRow } from 'pg';
import { parsePgArray } from '@/common/utils/pgArray';
import {
  AdminListFilter,
  AdminListResult,
  NearbySearchFilter,
  WorkerBroadcastMatch,
  WorkerNearbyResult,
  WorkerProfile,
  WorkerProfileWithAccount,
} from './interfaces';

function mapWorkerProfile(row: QueryResultRow): WorkerProfile {
  return {
    id: row.id,
    accountId: row.account_id,
    skillCategories: parsePgArray(row.skill_categories) as WorkerProfile['skillCategories'],
    otherSkillDescription: row.other_skill_description,
    experienceYears: row.experience_years,
    latitude: row.latitude,
    longitude: row.longitude,
    locationName: row.location_name ?? row.city ?? null,
    area: row.area,
    city: row.city,
    district: row.district,
    state: row.state,
    pincode: row.pincode,
    profilePhotoUrl: row.profile_photo_url ?? null,
    portfolioPhotoUrls: row.portfolio_photo_urls ?? [],
    verificationStatus: row.verification_status,
    ratingAverage: row.rating_count > 0 ? Math.round((row.rating_sum / row.rating_count) * 10) / 10 : null,
    ratingCount: row.rating_count ?? 0,
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
    accountStatus: row.account_status ?? 'active',
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
    latitude: number;
    longitude: number;
    locationName: string;
    area: string | null;
    city: string | null;
    district: string | null;
    state: string | null;
    pincode: string | null;
    portfolioPhotoUrls: string[];
  }): Promise<WorkerProfile> {
    const result = await this.pool.query(
      `INSERT INTO worker_profiles (account_id, skill_categories, other_skill_description, experience_years, latitude, longitude, area, city, district, state, pincode, portfolio_photo_urls, location_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        params.accountId,
        params.skillCategories,
        params.otherSkillDescription,
        params.experienceYears,
        params.latitude,
        params.longitude,
        params.area,
        params.city,
        params.district,
        params.state,
        params.pincode,
        params.portfolioPhotoUrls,
        params.locationName,
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
      latitude: number;
      longitude: number;
      locationName: string;
      area: string | null;
      city: string | null;
      district: string | null;
      state: string | null;
      pincode: string | null;
      portfolioPhotoUrls: string[];
      verificationStatus: string;
    },
  ): Promise<WorkerProfile> {
    const result = await this.pool.query(
      `UPDATE worker_profiles
       SET skill_categories = $2, other_skill_description = $3, experience_years = $4, latitude = $5, longitude = $6, area = $7, city = $8, district = $9, state = $10, pincode = $11, portfolio_photo_urls = $12, verification_status = $13, location_name = $14, updated_at = now()
       WHERE account_id = $1
       RETURNING *`,
      [
        accountId,
        params.skillCategories,
        params.otherSkillDescription,
        params.experienceYears,
        params.latitude,
        params.longitude,
        params.area,
        params.city,
        params.district,
        params.state,
        params.pincode,
        params.portfolioPhotoUrls,
        params.verificationStatus,
        params.locationName,
      ],
    );
    return mapWorkerProfile(result.rows[0]);
  }

  /** Sets (or clears) the profile photo; returns the profile and the photo it replaced, or null with no profile. */
  async setProfilePhoto(
    accountId: string,
    photoUrl: string | null,
  ): Promise<{ profile: WorkerProfile; previousUrl: string | null } | null> {
    const result = await this.pool.query(
      `UPDATE worker_profiles p SET profile_photo_url = $2, updated_at = now()
       FROM (SELECT profile_photo_url AS previous_url FROM worker_profiles WHERE account_id = $1 FOR UPDATE) old
       WHERE p.account_id = $1
       RETURNING p.*, old.previous_url`,
      [accountId, photoUrl],
    );
    if (!result.rows[0]) return null;
    return { profile: mapWorkerProfile(result.rows[0]), previousUrl: result.rows[0].previous_url ?? null };
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
    if (filter.q) {
      params.push(`%${filter.q}%`);
      conditions.push(`(a.full_name ILIKE $${params.length} OR a.mobile_number ILIKE $${params.length})`);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM worker_profiles w JOIN accounts a ON a.id = w.account_id ${whereClause}`,
      params,
    );
    const total = Number(countResult.rows[0].count);

    const offset = (filter.page - 1) * filter.limit;
    params.push(filter.limit, offset);
    const rows = await this.pool.query(
      `SELECT w.*, a.full_name AS account_full_name, a.mobile_number AS account_mobile_number, a.email AS account_email,
              a.status AS account_status
       FROM worker_profiles w
       JOIN accounts a ON a.id = w.account_id
       ${whereClause}
       ORDER BY w.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items: rows.rows.map(mapWorkerProfileWithAccount), total, page: filter.page, limit: filter.limit };
  }

  /** Adds one 1–5 star rating to the worker's running total (see migration 0016). */
  async addRating(workerId: string, stars: number): Promise<void> {
    await this.pool.query(
      `UPDATE worker_profiles SET rating_sum = rating_sum + $2, rating_count = rating_count + 1 WHERE id = $1`,
      [workerId, stars],
    );
  }

  /** Verified workers by id with their display name, for a customer's favorites list. */
  async findVerifiedByIds(ids: string[]): Promise<(WorkerProfile & { accountFullName: string })[]> {
    if (ids.length === 0) return [];
    const result = await this.pool.query(
      `SELECT w.*, a.full_name AS account_full_name
       FROM worker_profiles w JOIN accounts a ON a.id = w.account_id
       WHERE w.id = ANY($1::uuid[]) AND w.verification_status = 'verified'`,
      [ids],
    );
    return result.rows.map((row) => ({ ...mapWorkerProfile(row), accountFullName: row.account_full_name }));
  }

  async findById(id: string): Promise<WorkerProfileWithAccount | null> {
    const result = await this.pool.query(
      `SELECT w.*, a.full_name AS account_full_name, a.mobile_number AS account_mobile_number, a.email AS account_email,
              a.status AS account_status
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

  // --- Public nearby-search (see modules/search-equivalent note in businesses' own copy) —
  // distance is computed in SQL via the great-circle (Haversine) formula rather than pulling
  // every verified row into JS to compute it there; LEAST/GREATEST clamp the acos() argument
  // to [-1, 1] since floating-point rounding can push it a hair outside that domain for two
  // nearly-identical points, which would otherwise throw a Postgres "acos: input out of range".
  async findNearby(excludeAccountId: string, filter: NearbySearchFilter): Promise<WorkerNearbyResult[]> {
    // Fixed skills, and names workers typed themselves.
    const skills = splitSkills(filter.skillCategory ? filter.skillCategory.split(',') : []);
    // With custom names, 'other' would match every worker who typed anything — they match by name instead.
    const fixedSkills = skills.custom.length > 0 ? skills.fixed.filter((key) => key !== 'other') : skills.fixed;
    const like = filter.query ? `%${filter.query}%` : null;
    // 'rating': best average first (unrated workers last), more ratings breaking ties, then
    // nearest. The CASE keeps the division out of rows with no ratings yet.
    const orderBy =
      filter.sort === 'rating'
        ? `CASE WHEN sub.rating_count > 0 THEN sub.rating_sum::float / sub.rating_count END DESC NULLS LAST,
           sub.rating_count DESC, sub.distance_meters ASC`
        : 'sub.distance_meters ASC';
    const result = await this.pool.query(
      `SELECT * FROM (
         SELECT w.*, a.full_name AS account_full_name, a.mobile_number AS account_mobile_number, a.email AS account_email,
           (6371000 * acos(LEAST(1.0, GREATEST(-1.0,
             cos(radians($1)) * cos(radians(w.latitude)) * cos(radians(w.longitude) - radians($2)) + sin(radians($1)) * sin(radians(w.latitude))
           )))) AS distance_meters
         FROM worker_profiles w
         JOIN accounts a ON a.id = w.account_id
         WHERE w.verification_status = 'verified' AND a.status = 'active'
           AND w.latitude IS NOT NULL AND w.longitude IS NOT NULL
           AND w.account_id != $3
       ) sub
       WHERE sub.distance_meters <= $4
         AND ($5::text IS NULL OR ${filter.nameOnly ? 'sub.account_full_name ILIKE $5' : "sub.account_full_name ILIKE $5 OR sub.other_skill_description ILIKE $5 OR sub.location_name ILIKE $5 OR sub.city ILIKE $5 OR sub.area ILIKE $5 OR array_to_string(sub.skill_categories, ',') ILIKE $5"})
         AND (($7::worker_skill_category[] IS NULL AND cardinality($9::text[]) = 0)
           OR sub.skill_categories && COALESCE($7::worker_skill_category[], '{}')
           OR EXISTS (
             SELECT 1 FROM unnest(string_to_array(COALESCE(sub.other_skill_description, ''), ',')) AS have(name),
                           unnest($9::text[]) AS want(name)
             WHERE lower(trim(have.name)) = lower(trim(want.name))
           ))
       ORDER BY (sub.account_id = ANY($8::uuid[])) DESC, ${orderBy}
       LIMIT $6`,
      [
        filter.latitude,
        filter.longitude,
        excludeAccountId,
        filter.radiusKm * 1000,
        like,
        filter.limit,
        fixedSkills.length > 0 ? fixedSkills : null,
        filter.priorityAccountIds ?? [],
        skills.custom,
      ],
    );
    return result.rows.map((row) => ({
      ...mapWorkerProfile(row),
      distanceMeters: Number(row.distance_meters),
      accountFullName: row.account_full_name,
    }));
  }

  // --- Quick Book broadcast matching (see modules/bookings) — `skill_categories @>` is
  // array *containment*: a worker only matches if their skills are a superset of every
  // skill the requester asked for, not merely an overlap (a plumber-only worker doesn't
  // match an "electrician AND plumber" request). Distance math mirrors findNearby above.
  /** Distinct skill names verified workers typed under "other", matching the search. */
  async findCustomSkills(query: string): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT DISTINCT ON (lower(name)) name FROM (
         SELECT trim(unnest(string_to_array(other_skill_description, ','))) AS name
         FROM worker_profiles
         WHERE verification_status = 'verified' AND other_skill_description IS NOT NULL
       ) s
       WHERE name <> '' AND name ILIKE $1
       ORDER BY lower(name)
       LIMIT 15`,
      [`%${query}%`],
    );
    return result.rows.map((row) => row.name);
  }

  async findMatchingForBroadcast(
    requesterAccountId: string,
    skillCategories: string[],
    latitude: number,
    longitude: number,
    radiusKm: number,
    customSkills: string[] = [],
  ): Promise<WorkerBroadcastMatch[]> {
    const result = await this.pool.query(
      `SELECT * FROM (
         SELECT w.id AS worker_id, w.account_id, a.full_name AS account_full_name, a.preferred_language,
           (6371000 * acos(LEAST(1.0, GREATEST(-1.0,
             cos(radians($1)) * cos(radians(w.latitude)) * cos(radians(w.longitude) - radians($2)) + sin(radians($1)) * sin(radians(w.latitude))
           )))) AS distance_meters
         FROM worker_profiles w
         JOIN accounts a ON a.id = w.account_id
         WHERE w.verification_status = 'verified' AND a.status = 'active'
           AND w.latitude IS NOT NULL AND w.longitude IS NOT NULL
           AND w.account_id != $3
           AND w.skill_categories @> $4::worker_skill_category[]
           AND NOT EXISTS (SELECT 1 FROM unnest($6::text[]) c WHERE COALESCE(w.other_skill_description, '') NOT ILIKE '%' || c || '%')
       ) sub
       WHERE sub.distance_meters <= $5
       ORDER BY sub.distance_meters ASC`,
      [latitude, longitude, requesterAccountId, skillCategories, radiusKm * 1000, customSkills],
    );
    return result.rows.map((row) => ({
      workerId: row.worker_id,
      accountId: row.account_id,
      accountFullName: row.account_full_name,
      preferredLanguage: row.preferred_language,
      distanceMeters: Number(row.distance_meters),
    }));
  }

  /** Profile counts by verification state, for the admin dashboard. */
  async adminCounts(): Promise<{ total: number; pending: number; verified: number; rejected: number }> {
    const result = await this.pool.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE verification_status = 'pending_verification') AS pending,
              COUNT(*) FILTER (WHERE verification_status = 'verified') AS verified,
              COUNT(*) FILTER (WHERE verification_status = 'rejected') AS rejected
       FROM worker_profiles`,
    );
    const row = result.rows[0];
    return {
      total: Number(row.total),
      pending: Number(row.pending),
      verified: Number(row.verified),
      rejected: Number(row.rejected),
    };
  }
}
